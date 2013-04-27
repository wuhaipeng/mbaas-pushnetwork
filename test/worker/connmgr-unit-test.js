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

var expect  = require("expect.js"),
    sandbox = require("sandboxed-module"),
    MockedRedis = require("../lib/MockedRedis"),
    TestHelper  = require("../lib/TestHelper"),
    MockedClass = TestHelper.MockedClass,
    asyncExpect = TestHelper.asyncExpect;

describe("ConnectionManagement", function () {
    
    var MockedSocket = new Class({
        Extends: MockedClass,
        Implements: [process.EventEmitter],
        
        send: function (data) {
            this.emit("message", { type: "utf8", utf8Data: data });
        },

        drop: function () { },
        close: function () { }
    });
    
    var MockedRequest = new Class({
        initialize: function (connection) {
            this.connection = connection;
        },
        
        requestedProtocols: ["msg-json"],
        
        accept: function () {
            return this.connection;
        }
    });
    
    var MockedMessageQueue = new Class({
        Extends: MockedClass,
        
        loadMessages: function (regId, callback) {
            process.nextTick(function () {
                callback([]);
            });
            return this;
        },
        
        removeMessages: function (regId, msgIds, callback) {
            process.nextTick(callback);
            return this;
        }
    });
    
    function getConnMgr(sockets, msgQueue, mockedRedis, nameOrFindReg) {
        return sandbox.require("../../worker/lib/connmgr", {
            requires: {
                "http": {
                    createServer: function () {
                        return {
                            listen: function () { }
                        };
                    }
                },
                "websocket": {
                    server: new Class({
                        on: function () {
                            return sockets.on.apply(sockets, arguments);
                        },
                        
                        emit: function () {
                            return sockets.emit.apply(sockets, arguments);
                        }
                    })
                },
                "pn-common": {
                    Settings: {
                        SOCKET_MAXIDLE: 60000,
                        HEARTBEAT_EXPIRE: 60,
                        messageQueue: msgQueue,
                        registrations: {
                            find: typeof(nameOrFindReg) == "function" ? nameOrFindReg : function (regId, callback) {
                                callback(null, {});
                            }
                        },
                        connectRedis: function () { return mockedRedis; },
                        tracer: function () {
                            return function () { };
                        }
                    }
                },
                "./commander": {
                    get: function () {
                        return {
                            name: typeof(nameOrFindReg) == "string" ? nameOrFindReg : "TESTNAME",
                            addCommand: function () { }
                        };
                    }
                }
            }
        }).get();
    }
    
    function makeMsg (event, params) {
        params.event = event;
        return {
            type: "utf8",
            utf8Data: JSON.stringify(params)
        };
    }
    
    describe("Subscriptions", function () {
        it("add registration Ids", function (done) {
            var count = 0;
            var redis = new MockedRedis();
            redis.mock("multi", function () {
                var multi = new MockedRedis.Multi(redis);
                multi.mock("exec", function (callback) {
                    if (++ count == 2) {
                        asyncExpect(function () {
                            expect(redis.data).to.eql({
                                "abc123:s": {
                                    "worker.name": "TESTNAME",
                                    "worker.seq": 1
                                },
                                "abc321:s": {
                                    "worker.name": "TESTNAME",
                                    "worker.seq": 1
                                }
                            });                        
                        }, done)();
                    }
                    callback();
                });
                return multi;
            }, true);

            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), redis);
            connmgr.start();
            
            var socket = new MockedSocket();
            sockets.emit("request", new MockedRequest(socket));
            socket.emit("message", makeMsg("addRegId", { seq: 1, regIds: ["abc123", "abc321"] }));
        });
        
        it("remove registration Ids", function (done) {
            var inserts = 0, removed = false;
            var socket = new MockedSocket();
            
            var redis = new MockedRedis();
            redis.mock("multi", function () {
                var multi = new MockedRedis.Multi(redis);
                multi.mock("del", function (key) {
                    delete redis.data[key];
                    removed = true;
                }, true);
                multi.mock("exec", function (callback) {
                    if (removed) {
                        asyncExpect(function () {
                            expect(redis.data["abc123:s"]).be.ok();
                            expect(redis.data["abc321:s"]).not.be.ok();
                            expect(redis.data["abc123:s"]["worker.name"]).to.eql("TESTNAME");
                        }, done)();
                    } else {
                        if (++ inserts == 2) {
                            process.nextTick(function () {
                                socket.emit("message", makeMsg("removeRegId", { seq: inserts + 10, regIds: ["abc321"] }));
                            });
                        }
                    }
                    callback();
                }, true);
                return multi;
            }, true);
            
            var sockets = new process.EventEmitter();            
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), redis);
            connmgr.start();
            
            sockets.emit("request", new MockedRequest(socket));
            socket.emit("message", makeMsg("addRegId", { seq: 1, regIds: ["abc123", "abc321"] }));
        });
    });
    
    describe("Faults", function () {
        it("remap registration Id", function (done) {
            var pushedAt = new Date();
            var messages = [{ id: "m1", content: "m1content", pushedAt: pushedAt }];
            var msgQueue = new MockedMessageQueue();
            msgQueue.mock("loadMessages", function (regId, msgIds, callback) {
                if (typeof(msgIds) == "function") {
                    callback = msgIds;
                    callback(null, messages);
                } else {
                    callback(null, messages.filter(function (msg) { return msgIds.indexOf(msg.id) >= 0; }));
                }
                return this;
            });
            
            var redis = new MockedRedis();
            
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, msgQueue, redis);
            connmgr.start();
            
            var toBeDropped = new MockedSocket();
            sockets.emit("request", new MockedRequest(toBeDropped));
            toBeDropped.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event != "push") {
                    return;
                }
                expect(msg.info).be.an(Array);
                expect(msg.info).to.have.length(1);
                expect(msg.info[0]).to.eql({
                    regId: "TESTID",
                    messages: [
                        { id: "m1", content: "m1content", pushedAt: pushedAt.valueOf() }
                    ]
                });
                
                var received = []
                var reconnected = new MockedSocket();
                sockets.emit("request", new MockedRequest(reconnected));
                reconnected.on("message", asyncExpect(function (data) {
                    expect(data.type).to.eql("utf8");
                    var msg = JSON.parse(data.utf8Data);
                    if (msg.event != "push") {
                        return;
                    }
                    received.push(msg);
                    if (received.length == 1) {
                        expect(msg.info).to.eql([{
                            regId: "TESTID",
                            messages: [
                                { id: "m1", content: "m1content", pushedAt: pushedAt.valueOf() }
                            ]
                        }]);
                        messages.push({ id: "m2", content: "m2content", pushedAt: pushedAt });
                        connmgr.commandPush({ regId: "TESTID", msgId: "m2" }, function () { });
                    } else if (received.length == 2) {
                        expect(msg.info).to.eql([{
                            regId: "TESTID",
                            messages: [
                                { id: "m2", content: "m2content", pushedAt: pushedAt.valueOf() }
                            ]
                        }]);
                        done();
                    }
                }, done, true));
                reconnected.emit("message", makeMsg("addRegId", { regIds: ["TESTID"] }));
            }, done, true));
            toBeDropped.emit("message", makeMsg("addRegId", { regIds: ["TESTID"] }));
        });
        
        it("notify other instances to clean dead connection", function (done) {
            var pushedAt = new Date();
            var messages = [{ id: "m1", content: "m1content", pushedAt: pushedAt }];
            var msgQueue = new MockedMessageQueue();
            msgQueue.mock("loadMessages", function (regId, callback) {
                callback(null, messages);
                return this;
            });

            var redis = new MockedRedis();
            
            var sockets1 = new process.EventEmitter();
            var connmgr1 = getConnMgr(sockets1, msgQueue, redis, "CONNMGR1");
            connmgr1.start();
            
            var conn1 = new MockedSocket();
            sockets1.emit("request", new MockedRequest(conn1));
            conn1.mock("drop", asyncExpect(function () {
                expect(redis.data["TESTID:s"]["worker.name"]).to.eql("CONNMGR2");
            }, done), true);
            
            var sockets2 = new process.EventEmitter();
            var connmgr2 = getConnMgr(sockets2, msgQueue, redis, "CONNMGR2");
            connmgr2.start();
            
            var conn2 = new MockedSocket();
            sockets2.emit("request", new MockedRequest(conn2));

            conn1.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event != "push") {
                    return;
                }
                expect(msg.info).to.eql([{
                    regId: "TESTID",
                    messages: [
                        { id: "m1", content: "m1content", pushedAt: pushedAt.valueOf() }
                    ]
                }]);
                
                conn2.on("message", asyncExpect(function (data) {
                    expect(data.type).to.eql("utf8");
                    var msg = JSON.parse(data.utf8Data);
                    if (msg.event != "push") {
                        return;
                    }
                    expect(redis.data["CONNMGR1:q"]).be.an(Array);
                    expect(redis.data["CONNMGR1:q"]).to.have.length(1);
                    var command = JSON.parse(redis.data["CONNMGR1:q"]);
                    expect(command.action).to.eql("clean");
                    expect(command.regId).to.eql("TESTID");
                    connmgr1.commandClean(command, function () { });
                }, done, true));
                conn2.emit("message", makeMsg("addRegId", { regIds: ["TESTID"] }));
            }, done, true));
            conn1.emit("message", makeMsg("addRegId", { regIds: ["TESTID"] }));
        });
    });
    
    describe("InvalidEvents", function () {
        it("#addRegId with invalid format", function (done) {
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), new MockedRedis());
            connmgr.start();
            
            var conn = new MockedSocket();
            sockets.emit("request", new MockedRequest(conn));

            conn.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event == "error") {
                    expect(msg.seq).to.eql(123);
                    expect(msg.type).to.eql("BadFormat");
                    done();
                }
            }, done, true));
            conn.emit("message", makeMsg("addRegId", { seq: 123, regIds: 123 })); 
        });
        
        it("#addRegId with invalid registration Id", function (done) {
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), new MockedRedis(), function (regId, callback) {
                callback(null, null);
            });
            connmgr.start();
            
            var conn = new MockedSocket();
            sockets.emit("request", new MockedRequest(conn));

            conn.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event == "error") {
                    expect(msg.seq).to.eql(12345);
                    expect(msg.type).to.eql("RegIds");
                    expect(msg.regIds).be.ok();
                    expect(msg.regIds["TESTID"]).to.eql("Invalid");
                    done();
                }
            }, done, true));
            conn.emit("message", makeMsg("addRegId", { seq: 12345, regIds: ["TESTID"] }));
        });
        
        it("#pushAck with invalid format", function (done) {
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), new MockedRedis());
            connmgr.start();
            
            var conn = new MockedSocket();
            sockets.emit("request", new MockedRequest(conn));

            conn.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event == "error") {
                    expect(msg.seq).to.eql(456);
                    expect(msg.type).to.eql("BadFormat");
                    done();
                }
            }, done, true));
            conn.emit("message", makeMsg("pushAck", { seq: 456 })); 
        });
        
        it("#pushAck with invalid registration Id", function (done) {
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), new MockedRedis());
            connmgr.start();
            
            var conn = new MockedSocket();
            sockets.emit("request", new MockedRequest(conn));
            
            conn.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                if (msg.event == "error") {
                    expect(msg.seq).to.eql(45678);
                    expect(msg.type).to.eql("Acks");
                    expect(msg.acks).to.eql([{ regId: "INVALIDREGID", error: "Invalid" }]);
                    done();
                }
            }, done, true));
            conn.emit("message", makeMsg("pushAck", { seq: 45678, info: [{ regId: "INVALIDREGID", messageIds: ["id1", "id2"] }] }));
        });
    });
});
