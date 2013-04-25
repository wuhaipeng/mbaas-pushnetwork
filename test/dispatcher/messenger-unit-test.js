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

describe("Dispatcher", function () {
    
    var MockedStore = new Class({
        Extends: MockedClass,
        
        initialize: function () {
            this.id = 0;
        },
        
        newId: function () {
            return ++ this.id;
        },
        
        createMessage: function (content, callback) {
            var id = this.newId();
            process.nextTick(function () {
                callback(null, { id: id, content: content });
            });
        },
        
        enqueueMessage: function (regId, msgId, callback) {
            process.nextTick(function () {
                callback(null, { regId: regId, msgId: msgId, pushedAt: new Date() });
            });
        }
    });
    
    function getMessenger(mockedStore, mockedRedis) {
        return sandbox.require("../../dispatcher/lib/messenger", {
            requires: {
                "pn-common": {
                    Settings: {
                        HEARTBEAT_EXPIRE: 60,
                        connectRedis: function () { return mockedRedis; },
                        messageStore: mockedStore,
                        tracer: function () {
                            return function () { };
                        }
                    }
                }
            }
        }).get();
    }
    
    describe("messenger", function () {
        it("#post with commands dispatched", function (done) {
            var redis = new MockedRedis();
            redis.data = {
                "a:s": { "worker.name": "w", "worker.seq": 1 },
                "b:s": { "worker.name": "v", "worker.seq": 1 },
                "c:s": { "worker.name": "w", "worker.seq": 1 }
            };
            var store = new MockedStore();
            store.mock("newId", function () { return "m1"; }, true);
            
            var messenger = getMessenger(store, redis);
            messenger.post("content", ["a", "b", "c"], asyncExpect(function (err, message, failedRegIds) {
                expect(err).not.be.ok();
                expect(message).be.ok();
                expect(message.id).to.eql("m1");
                expect(failedRegIds).to.eql([]);
                expect(redis.data["w:q"]).be.an(Array);
                expect(redis.data["w:q"].map(function (item) { return JSON.parse(item); })).to.eql([
                    { action: "push", regId: "c", msgId: "m1" },
                    { action: "push", regId: "a", msgId: "m1" }
                ]);
                expect(redis.data["v:q"]).be.an(Array);
                expect(redis.data["v:q"].map(function (item) { return JSON.parse(item); })).to.eql([
                    { action: "push", regId: "b", msgId: "m1" }
                ]);
            }, done));
        });
        
        it("#post with message creation failed", function (done) {
            var store = new MockedStore();
            store.mock("createMessage", function (content, callback) {
                callback(new Error("CreateMessageError"));
            });
            
            var messenger = getMessenger(store, new MockedRedis());
            messenger.post("content", ["a", "b", "c"], asyncExpect(function (err, message, failedRegIds) {
                expect(err).be.ok();
                expect(err.message).to.eql("CreateMessageError");
                expect(message).not.be.ok();
                expect(failedRegIds).not.be.ok();
            }, done));            
        });
        
        it("#post with enqueueMessage failed on some registration Ids", function (done) {
            var redis = new MockedRedis();
            redis.data = {
                "a:s": { "worker.name": "w", "worker.seq": 1 },
                "b:s": { "worker.name": "v", "worker.seq": 1 },
                "c:s": { "worker.name": "w", "worker.seq": 1 }
            };
            var store = new MockedStore();
            store.mock("newId", function () { return "m1"; }, true);
            store.mock("enqueueMessage", function (regId, msgId, callback) {
                if (regId == "c") {
                    callback(new Error("EnqueueMessageError"));
                } else {
                    callback(null, { regId: regId, msgId: msgId, pushedAt: new Date() });
                }
            });
            
            var messenger = getMessenger(store, redis);
            messenger.post("content", ["a", "b", "c"], asyncExpect(function (err, message, failedRegIds) {
                expect(err).not.be.ok();
                expect(message).be.ok();
                expect(message.id).to.eql("m1");
                expect(failedRegIds).to.eql(["c"]);
                expect(redis.data["w:q"]).be.an(Array);
                expect(redis.data["w:q"].map(function (item) { return JSON.parse(item); })).to.eql([
                    { action: "push", regId: "a", msgId: "m1" }
                ]);
                expect(redis.data["v:q"]).be.an(Array);
                expect(redis.data["v:q"].map(function (item) { return JSON.parse(item); })).to.eql([
                    { action: "push", regId: "b", msgId: "m1" }
                ]);
            }, done));            
        });
    });
});