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
        
        disconnect: function () { }
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
    
    function getConnMgr(sockets, msgQueue, mockedRedis, name) {
        return sandbox.require("../../worker/lib/connmgr", {
            requires: {
                "http": {
                    createServer: function () {
                        return {
                            listen: function () { }
                        };
                    }
                },
                "socket.io": {
                    sockets: sockets,
                    listen: function () {
                        return {
                            sockets: sockets
                        };
                    }
                },
                "pn-common": {
                    Settings: {
                        SOCKET_MAXIDLE: 60000,
                        HEARTBEAT_EXPIRE: 60,
                        messageQueue: msgQueue,
                        connectRedis: function () { return mockedRedis; }
                    }
                },
                "./commander": {
                    get: function () {
                        return {
                            name: name ? name : "TESTNAME",
                            addCommand: function () { }
                        };
                    }
                }
            }
        }).get();
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
            sockets.emit("connection", socket);
            socket.emit("addRegId", '{ "regIds": ["abc123", "abc321"] }');
        });
        
        it("remove registration Ids", function (done) {
            var removed = false;
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
                    }
                    callback();
                }, true);
                return multi;
            }, true);
            
            var sockets = new process.EventEmitter();            
            var connmgr = getConnMgr(sockets, new MockedMessageQueue(), redis);
            connmgr.start();
            
            var socket = new MockedSocket();
            sockets.emit("connection", socket);
            socket.emit("addRegId", '{ "regIds": ["abc123", "abc321"] }');
            socket.emit("removeRegId", '{ "regIds": ["abc321"] }');
        });
    });
    
    describe("Faults", function () {
        it("remap registration Id", function (done) {
            var pushedAt = new Date();
            var messages = [{ id: "m1", content: "m1content", pushedAt: pushedAt }];
            var msgQueue = new MockedMessageQueue();
            msgQueue.mock("loadMessages", function (regId, callback) {
                callback(null, messages);
                return this;
            });
            
            var redis = new MockedRedis();
            
            var sockets = new process.EventEmitter();
            var connmgr = getConnMgr(sockets, msgQueue, redis);
            connmgr.start();
            
            var toBeDropped = new MockedSocket();
            sockets.emit("connection", toBeDropped);
            toBeDropped.on("push", asyncExpect(function (data) {
                var msg = JSON.parse(data);
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
                sockets.emit("connection", reconnected);
                reconnected.on("push", asyncExpect(function (data) {
                    var msg = JSON.parse(data);
                    received.push(msg);
                    if (received.length == 1) {
                        expect(msg).to.eql({
                            info: [{
                                regId: "TESTID",
                                messages: [
                                    { id: "m1", content: "m1content", pushedAt: pushedAt.valueOf() }
                                ]
                            }]
                        });
                        messages.push({ id: "m2", content: "m2content", pushedAt: pushedAt });
                        connmgr.commandPush({ regId: "TESTID", msgId: "m2" }, function () { });
                    } else if (received.length == 2) {
                        expect(msg).to.eql({
                            info: [{
                                regId: "TESTID",
                                messages: [
                                    { id: "m2", content: "m2content", pushedAt: pushedAt.valueOf() }
                                ]
                            }]
                        });
                        done();
                    }
                }, done, true));
                reconnected.emit("addRegId", '{ "regIds": ["TESTID"] }');
            }, done, true));
            toBeDropped.emit("addRegId", '{ "regIds": ["TESTID"] }');
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
            sockets1.emit("connection", conn1);
            conn1.mock("disconnect", asyncExpect(function (opts) {
                expect(opts).to.eql(true);
                expect(redis.data["TESTID:s"]["worker.name"]).to.eql("CONNMGR2");
            }, done), true);
            
            var sockets2 = new process.EventEmitter();
            var connmgr2 = getConnMgr(sockets2, msgQueue, redis, "CONNMGR2");
            connmgr2.start();
            
            var conn2 = new MockedSocket();
            sockets2.emit("connection", conn2);

            conn1.on("push", asyncExpect(function (data) {
                var msg = JSON.parse(data);
                expect(msg).to.eql({
                    info: [{
                        regId: "TESTID",
                        messages: [
                            { id: "m1", content: "m1content", pushedAt: pushedAt.valueOf() }
                        ]
                    }]
                });
                
                conn2.on("push", asyncExpect(function (data) {
                    expect(redis.data["CONNMGR1:q"]).be.an(Array);
                    expect(redis.data["CONNMGR1:q"]).to.have.length(1);
                    var command = JSON.parse(redis.data["CONNMGR1:q"]);
                    expect(command.action).to.eql("clean");
                    expect(command.regId).to.eql("TESTID");
                    connmgr1.commandClean(command, function () { });
                }, done, true));
                conn2.emit("addRegId", '{ "regIds": ["TESTID"] }');
            }, done, true));
            conn1.emit("addRegId", '{ "regIds": ["TESTID"] }');
        });
    });
});
