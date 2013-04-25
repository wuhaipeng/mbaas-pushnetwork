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

var http      = require("http"),
    io        = require("socket.io"),
    async     = require("async"),
    Settings  = require("pn-common").Settings,
    trace     = Settings.tracer("pn:work:conn"),
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
        this.name = this.id + "." + socket.id;
        this.regIds = { };
        
        this.sub("addRegId")
            .sub("removeRegId")
            .sub("pushAck");

        socket.on("disconnect", this.close.bind(this));
        
        // the client is expected to send a message after connected
        // within SOCKET_MAXIDLE
        this.idleTimer = setTimeout(function () {
            this.close();
        }.bind(this), Settings.SOCKET_MAXIDLE);
        
        trace("%s: CONNECTED", this.name);
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
                trace("%s: Ignore: %s [%s]", this.name, e.message, data);
                // TODO bad message
            }
            if (msg) {
                trace("%s: MSG[%s] %j", this.name, name, msg);
                this[name].call(this, msg);
            }
        }.bind(this));
        return this;
    },
    
    send: function (event, params) {
        trace("%s: RESP[%s] %j", this.name, event, params);
        this.socket.emit(event, JSON.stringify(params));
    },
    
    unreg: function (regId) {
        trace("%s: REGID - %s", this.name, regId);
        delete this.regIds[regId];
    },
    
    close: function () {
        trace("%s: CLOSE %j", this.name, this.regIds);
        async.each(Object.keys(this.regIds), function (regId, next) {
            theConnectionManager.updateRegistration(regId, this, false, function () {
                process.nextTick(next);
            });
        }.bind(this), function () {
            this.socket.disconnect(true);
        }.bind(this));
    },
    
    resendMessages: function (regId) {
        Settings.messageQueue.loadMessages(regId, function (err, msgs) {
            if (!err && Array.isArray(msgs) && msgs.length > 0) {
                this.send("push", makePushMsg(regId, msgs));
            }
        }.bind(this));
    },
    
    sendMessages: function (regId, msgIds) {
        Settings.messageQueue.loadMessages(regId, function (err, msgs) {
            if (!err && Array.isArray(msgs)) {
                msgs = msgs.filter(function (msg) {
                    return msgIds.indexOf(msg.id) >= 0;
                });
                if (msgs.length > 0) {
                    this.send("push", makePushMsg(regId, msgs));
                }
            }
        }.bind(this));
    },
    
    addRegId: function (params) {
        this.ensureArray(params, "regIds", function (regIds) {
            var errorRegIds = {};
            async.each(regIds, function (regId, next) {
                Settings.registrations.find(regId, function (err, info) {
                    if (!err && info) {
                        theConnectionManager.updateRegistration(regId, this, true, function (err) {
                            if (err) {
                                errorRegIds[regId] = err.message;
                            } else {
                                trace("%s: REGID + %s", this.name, regId);
                                this.regIds[regId] = true;
                            }
                            process.nextTick(next);
                        }.bind(this));
                    } else {
                        errorRegIds[regId] = err ? err.message : "Invalid";
                        next();
                    }
                }.bind(this));
            }.bind(this), this.errorHandler(params, "RegIds", "regIds", errorRegIds));
        });
    },
    
    removeRegId: function (params) {
        this.ensureArray(params, "regIds", function (regIds) {
            async.each(regIds, function (regId, next) {
                if (this.regIds[regId]) {
                    theConnectionManager.updateRegistration(regId, this, false, function (err) {
                        if (!err) {
                            this.unreg(regId);
                        }
                        process.nextTick(next);
                    }.bind(this));
                } else {
                    next();
                }
            }.bind(this));
        });
    },
    
    pushAck: function (params) {
        this.ensureArray(params, "info", function (acks) {
            var errorAcks = [];
            async.each(acks, function (ack, next) {
                if (ack.regId && Array.isArray(ack.messageIds)) {
                    if (this.regIds[ack.regId]) {
                        Settings.messageQueue.removeMessages(ack.regId, ack.messageIds, function (err) {
                            if (err) {
                                errorAcks.push({
                                    regId: ack.regId,
                                    error: err.message
                                });
                            }
                            next();
                        });
                    } else {
                        errorAcks.push({
                            regId: ack.regId,
                            error: "Invalid"
                        });
                        next();
                    }
                } else {
                    next();
                }
            }.bind(this), this.errorHandler(params, "Acks", "acks", errorAcks));
        });
    },
    
    ensureArray: function (msg, attr, processFn) {
        if (Array.isArray(msg[attr])) {
            processFn.call(this, msg[attr]);
        } else {
            this.send("error", { seq: msg.seq, type: "BadFormat", msg: "Not an array" });
        }
    },
    
    errorHandler: function (msg, errorType, extraAttr, value) {
        return function () {
            if (Object.keys(value).length > 0) {
                var event = {
                    seq: msg.seq,
                    type: errorType
                };
                event[extraAttr] = value;
                this.send("error", event);
            }
        }.bind(this);
    }
});

var ConnectionManager = new Class({
    initialize: function () {
        this.connMap = { };
        this.redis = Settings.connectRedis();
        commander.get().addCommand("push", this.commandPush.bind(this));
        commander.get().addCommand("clean", this.commandClean.bind(this));
    },
    
    start: function (callback) {
        this.httpServer = http.createServer(function (req, res) {
            res.writeHead(403);
            res.end();
        });
        this.sockets = io.listen(this.httpServer, {
            "log level": process.env.NODE_ENV == "production" ? 0 : 3
        });
        this.sockets.sockets.on("connection", function (socket) {
            new Connection(socket);
        });
        this.httpServer.listen(Settings.LISTENING_PORT, callback);
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
        async.series([
            function (next) {
                redis.watch(key, next);
            },
            function (next) {
                redis.hmget(key, "worker.name", "worker.seq", function (err, values) {
                    if (!err && Array.isArray(values) && values[0] &&
                        (values[0] != commander.get().name || values[1] != connection.id)) {
                        takeFrom = {
                            name: values[0],
                            seq: values[1]
                        };
                    }
                    next();
                });
            },
            function (next) {
                // when disconnect, only clean with "worker" is current worker
                if (!mapped && takeFrom) {
                    redis.unwatch(next);
                } else {
                    var multi = redis.multi();
                    if (mapped) {
                        multi.hmset(key, { "worker.name": commander.get().name, "worker.seq": connection.id });
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
                            .expire(key, Settings.HEARTBEAT_EXPIRE)
                            .exec(function () { });
                        trace("TAKEOVER from %s.%s", takeFrom.name, takeFrom.seq);
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

exports.start = function (callback) {
    exports.get().start(callback);
};
