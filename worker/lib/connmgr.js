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
    WebSocket = require("websocket").server,
    async     = require("async"),
    Settings  = require("pn-common").Settings,
    trace     = Settings.tracer("pn:work:conn"),
    protocols = require("./protocols");
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
    Implements: [process.EventEmitter],
    
    initialize: function (socket, protocol) {
        this.socket = socket;
        this.protocol = protocol;
        this.id = ++ connectionSeq;
        this.name = this.id + ":" + socket.remoteAddress;
        this.regIds = { };

        socket.on("message", function (message) {
            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
                delete this.idleTimer;
            }

            var msg = this.protocol.decode(message);
            if (msg && typeof(msg.event) == "string") {
                var action = "action" + msg.event[0].toUpperCase() + msg.event.substr(1);
                if (typeof(this[action]) == "function") {
                    trace("%s: MSG %j", this.name, msg);
                    this[action].call(this, msg);
                } else {
                    trace("%s: BadAction %j", this.name, msg);
                }
            } else {
                trace("%s: DROP %j", this.name, message);
            }
        }.bind(this)).on("close", function (reasonCode, description) {
            trace("%s: CLOSE %d " + description, this.name, reasonCode);
            this.cleanup();
        }.bind(this)).on("error", function (error) {
            trace("%s: ERROR %s", this.name, error.message);
        }.bind(this));

        // the client is expected to send a message after connected
        // within SOCKET_MAXIDLE
        this.idleTimer = setTimeout(function () {
            this.close();
        }.bind(this), Settings.SOCKET_MAXIDLE);
    },
    
    send: function (event, params) {
        trace("%s: RESP[%s] %j", this.name, event, params);
        var data = this.protocol.encode(event, params);
        this.socket.send(data);
    },
    
    unreg: function (regId) {
        trace("%s: REGID - %s", this.name, regId);
        delete this.regIds[regId];
    },
    
    cleanup: function (callback) {
        trace("%s: CLEAN %j", this.name, this.regIds);
        async.each(Object.keys(this.regIds), function (regId, next) {
            theConnectionManager.updateRegistration(regId, this, false, function () {
                process.nextTick(next);
            });
        }.bind(this), callback);
    },
    
    close: function (drop) {
        this.cleanup(function () {
            if (drop) {
                this.socket.drop();
            } else {
                this.socket.close();
            }
        }.bind(this));
    },
    
    resendMessages: function (regId) {
        Settings.messageQueue.loadMessages(regId, function (err, msgs) {
            if (err) {
                trace("%s: RESEND LoadMsg Error: %s", this.name, err.message);
            } else if (Array.isArray(msgs) && msgs.length > 0) {
                this.send("push", makePushMsg(regId, msgs));
            }
        }.bind(this));
    },
    
    sendMessages: function (regId, msgIds) {
        Settings.messageQueue.loadMessages(regId, msgIds, function (err, msgs) {
            if (err) {
                trace("%s: SENDMSG LoadMsg Error: %s", this.name, err.message);
            } else if (Array.isArray(msgs) && msgs.length > 0) {
                this.send("push", makePushMsg(regId, msgs));
            } else {
                trace("%s: SENDMSG No Message", this.name);
            }
        }.bind(this));
    },
    
    actionAddRegId: function (params) {
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
    
    actionRemoveRegId: function (params) {
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
    
    actionPushAck: function (params) {
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
        var httpServer = http.createServer(function (req, res) {
            res.writeHead(403);
            res.end();
        });
        this.sockets = new WebSocket({ httpServer: httpServer });
        this.sockets.on("request", function (request) {
            var protocol = protocols.select(request.requestedProtocols);
            if (!protocol) {
                request.reject(400, "Protocol Unsupported");
            } else {
                var connection = request.accept(protocol.name, request.origin);
                trace("ACCEPT [%s] from %s (%s)", protocol.name, connection.remoteAddress, request.origin);
                new Connection(connection, protocol);
            }
        });
        httpServer.listen(Settings.LISTENING_PORT, callback);
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
            connection.close(true);
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
