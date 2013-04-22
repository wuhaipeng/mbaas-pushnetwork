// Copyright 2013 [copyright owner]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var io     = require("socket.io"),
    async  = require("async"),
    common = require("pn-common"),
    commander = require("./commander");

var theConnectionManager;

function makePushMsg(regId, msgs) {
    return {
        info: [{
            regId: regId,
            messages: msgs.map(function (msg) {
                return { id: msg.id, content: msg.content, pushedAt: msg.pushedAt.valueOf() };
            })
        }]
    };
}

var connectionSeq = 0;

var Connection = new Class({
    initialize: function (socket) {
        this.socket = socket;
        this.id = ++ connectionSeq;
        this.regIds = { };
        
        this.sub("addRegId")
            .sub("removeRegId")
            .sub("pushAck");

        socket.on("disconnect", this.close.bind(this));
        
        // the client is expected to send a message after connected
        // within SOCKET_MAXIDLE
        this.idleTimer = setTimeout(function () {
            this.close();
        }.bind(this), common.Settings.SOCKET_MAXIDLE);
    },
    
    sub: function (name) {
        this.socket.on(name, function (data) {
            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
                delete this.idleTimer;
            }
            var msg;
            try {
                msg = JSON.parse(data);
            } catch (e) {
                // TODO bad message
            }
            if (msg) {
                this[name].call(this, msg);
            }
        }.bind(this));
        return this;
    },
    
    send: function (event, params) {
        this.socket.emit(event, JSON.stringify(params));
    },
    
    unreg: function (regId) {
        delete this.regIds[regId];
    },
    
    close: function () {
        async.each(Object.keys(this.regIds), function (regId, next) {
            theConnectionManager.updateRegistration(regId, this, false, next);
        }.bind(this), function () {
            this.socket.disconnect(true);
        }.bind(this));
    },
    
    resendMessages: function (regId) {
        common.Settings.messageQueue.loadMessages(regId, function (msgs) {
            this.send("push", makePushMsg(regId, msgs));
        }.bind(this));
    },
    
    sendMessages: function (regId, msgIds) {
        common.Settings.messageQueue.loadMessages(regId, function (msgs) {
            msgs = msgs.filter(function (msg) {
                return msgIds.indexOf(msg.id) >= 0;
            });
            if (msgs.length > 0) {
                this.send("push", makePushMsg(regId, msgs));
            }
        }.bind(this));
    },
    
    addRegId: function (params) {
        this.ensureArray(params, "regIds", function (regIds) {
            async.each(regIds, function (regId, next) {
                theConnectionManager.updateRegistration(regId, this, true, function (err) {
                    if (!err) {
                        this.regIds[regId] = true;
                    }
                    next(err);
                }.bind(this));
            }.bind(this), this.errorHandler(params));
        });
    },
    
    removeRegId: function (params) {
        this.ensureArray(params, "regIds", function (regIds) {
            async.each(regIds, function (regId, next) {
                theConnectionManager.updateRegistration(regId, this, false, function (err) {
                    if (!err) {
                        this.unreg(regId);
                    }
                    next(err);
                }.bind(this));
            }.bind(this), this.errorHandler(params));
        });
    },
    
    pushAck: function (params) {
        this.ensureArray(params, "info", function (acks) {
            async.each(acks, function (ack, next) {
                if (ack.regId && Array.isArray(ack.messageIds)) {
                    common.Settings.messageQueue.removeMessages(ack.regId, ack.messageIds, next);
                } else {
                    next();
                }
            }.bind(this), this.errorHandler(params));
        });
    },
    
    ensureArray: function (msg, attr, processFn) {
        if (Array.isArray(msg[attr])) {
            processFn.call(this, msg[attr]);
        } else {
            this.send("error", { seq: msg.seq, type: "BadFormat", msg: "Not an array" });
        }
    },
    
    errorHandler: function (msg) {
        return function (err) {
            if (err) {
                this.send("error", { seq: msg.seq, type: "Error", error: err });
            }
        }.bind(this);
    }
});

var ConnectionManager = new Class({
    initialize: function () {
        this.connMap = { };
        this.redis = common.Settings.connectRedis();
        commander.get().addCommand("push", this.commandPush.bind(this));
        commander.get().addCommand("clean", this.commandClean.bind(this));
    },
    
    start: function () {
        io.sockets.on("connection", function (socket) {
            new Connection(socket);
        });
        io.listen(process.env.PORT || 3000);
    },
    
    updateRegistration: function (regId, connection, mapped, callback) {
        var oldConn = this.connMap[regId];
        if (mapped) {
            if (oldConn && oldConn.id == connection.id) {
                callback();
                return;
            }
            this.connMap[regId] = connection;
        } else {
            if (!oldConn || oldConn.id != connection.id) {
                callback();
                return;
            }
            delete this.connMap[regId];
        }
        
        var key = regId + ":s", takeFrom, redis = this.redis;
        var thisWorker = commander.get().name + "." + connection.id;
        async.series([
            function (next) {
                redis.watch(key, next);
            },
            function (next) {
                redis.hget(key, "worker", function (err, value) {
                    if (!err && value && value != thisWorker) {
                        var pos = value.lastIndexOf(".");
                        if (pos >= 0) {
                            takeFrom = {
                                name: value.substr(0, pos),
                                id: value.substr(pos + 1)
                            };
                        }
                    }
                    next();
                });
            },
            function (next) {
                // when disconnect, only clean with "worker" == thisWorker
                if (!mapped && takeFrom) {
                    redis.unwatch(next);
                } else {
                    var multi = redis.multi();
                    if (mapped) {
                        multi.hset(key, "worker", thisWorker);
                    } else {
                        multi.del(key);
                    }
                    multi.exec(next);
                }
            }
        ], function (err) {
                if (!err && mapped) {
                    if (oldConn) {
                        oldConn.unreg(regId);
                    }
                    // Notify other worker instance to clean up dead connections
                    if (takeFrom && takeFrom.name != commander.get().name) {
                        var key = takeFrom.name + ":q";
                        redis.multi()
                            .lpush(key, JSON.stringify({ action: "clean", regId: regId }))
                            .expire(key, common.Settings.HEARTBEAT_EXPIRE)
                            .exec(function () { });
                    }
                    // Push queued messages for new registration Id
                    connection.resendMessages(regId);
                }
                callback(err);
            }
        );
    },
    
    commandPush: function (command, done) {
        var connection = this.connMap[command.regId];
        if (connection) {
            connection.sendMessages(command.regId, [command.msgId]);
        }
        done();
    },
    
    commandClean: function (command, done) {
        var connection = this.connMap[command.regId];
        if (connection) {
            connection.close();
        }
        done();
    }
});

exports.get = function () {
    if (!theConnectionManager) {
        theConnectionManager = new ConnectionManager();
    }
    return theConnectionManager;
};

exports.start = function () {
    exports.get().start();
};
