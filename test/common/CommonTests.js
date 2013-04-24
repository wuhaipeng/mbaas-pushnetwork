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

var expect = require("expect.js"),
    async  = require("async"),
    asyncExpect = require("../lib/TestHelper").asyncExpect;

module.exports = function (factory) {

    var CONTENT = "Dummy Message Content";
    var DEFAULT_TTL = 43200;
    var REGID = "Dummy Reg Id";
    
    var store, queue, regs;
    
    before(function () {
        var MessageStore  = require("../../common/lib/MessageStore");
        var MessageQueue  = require("../../common/lib/MessageQueue");
        var Registrations = require("../../common/lib/Registrations");
        
        var dataAccessor = factory.createDataAccessor();
        store = new MessageStore(dataAccessor);
        queue = new MessageQueue(dataAccessor);
        regs  = new Registrations(dataAccessor);
    });
    
    it("#createMessage with default TTL", function (done) {
        var now = new Date();
        store.createMessage(CONTENT, asyncExpect(function (err, message) {
            expect(err).not.be.ok();
            expect(message).be.ok();
            expect(message.id).be.ok();
            expect(message.content).to.eql(CONTENT);
            expect(message.expireAt).be.ok();
            var ttl = Math.floor((message.expireAt.valueOf() - now.valueOf()) / 60000);
            expect(ttl).to.eql(DEFAULT_TTL);
        }, done));
    });

    it("#createMessage with specified TTL", function (done) {
        var now = new Date();
        var specifiedTTL = 1440;
        store.createMessage(CONTENT, { ttl: specifiedTTL }, asyncExpect(function (err, message) {
            expect(err).not.be.ok();
            expect(message).be.ok();
            expect(message.id).be.ok();
            expect(message.content).to.eql(CONTENT);
            expect(message.expireAt).be.ok();
            var ttl = Math.floor((message.expireAt.valueOf() - now.valueOf()) / 60000);
            expect(ttl).to.eql(specifiedTTL);
        }, done));
    });
    
    it("#enqueueMessage", function (done) {
        store.createMessage(CONTENT, asyncExpect(function (err, message) {
            expect(err).not.be.ok();
            expect(message).be.ok();
            store.enqueueMessage(REGID, message.id, asyncExpect(function (err, msgRef) {
                expect(err).not.be.ok();
                expect(msgRef).be.ok();
                expect(msgRef.regId).to.eql(REGID);
                expect(msgRef.msgId).to.eql(message.id);
                expect(msgRef.pushedAt).be.ok();
            }, done));
        }, done, true));
    });
    
    it("#enqueueMessage pushes out oldest messages", function (done) {
        var maxQueuedMsgs = require("../../common/lib/Settings").MAX_QUEUEDMSGS;
        async.timesSeries(maxQueuedMsgs + 1, function (n, next) {
            setTimeout(function () {
                store.createMessage(CONTENT, asyncExpect(function (err, msg) {
                    expect(err).not.be.ok();
                    expect(msg).be.ok();
                    store.enqueueMessage(REGID, msg.id, asyncExpect(function (err, msgRef) {
                        expect(err).not.be.ok();
                        expect(msgRef).be.ok();
                        expect(msgRef.regId).to.eql(REGID);
                        expect(msgRef.msgId).to.eql(msg.id);
                        expect(msgRef.pushedAt).be.ok();
                        next(err, msgRef);
                    }, done, true));                    
                }, done, true));
            }, 10);
        }, function (err, msgRefs) {
            var enqueuedIds = msgRefs.sort(function (mr1, mr2) { return mr1.pushedAt.valueOf() - mr2.pushedAt.valueOf() })
                                     .map(function (msgRef) { return msgRef.msgId; });
            queue.loadMessages(REGID, asyncExpect(function (err, messages) {
                expect(err).not.be.ok();
                expect(messages).be.an(Array);
                expect(messages).to.have.length(maxQueuedMsgs);
                expect(messages.map(function (msg) { return msg.id })).to.eql(enqueuedIds.slice(1).reverse());
            }, done));
        });
    });
    
    it("#loadMessages with specified message Ids", function (done) {
        async.timesSeries(5, function (n, next) {
            setTimeout(function () {
                store.createMessage(CONTENT, asyncExpect(function (err, msg) {
                    expect(err).not.be.ok();
                    expect(msg).be.ok();
                    store.enqueueMessage(REGID, msg.id, asyncExpect(function (err, msgRef) {
                        expect(err).not.be.ok();
                        expect(msgRef).be.ok();
                        expect(msgRef.regId).to.eql(REGID);
                        expect(msgRef.msgId).to.eql(msg.id);
                        expect(msgRef.pushedAt).be.ok();
                        next(err, msgRef);
                    }, done, true));                    
                }, done, true));
            }, 10);
        }, function (err, msgRefs) {
            var msgIds = msgRefs.map(function (msgRef) { return msgRef.msgId; }).reverse().slice(2, 4);
            queue.loadMessages(REGID, msgIds, asyncExpect(function (err, messages) {
                expect(err).not.be.ok();
                expect(messages).be.an(Array);
                expect(messages).to.have.length(msgIds.length);
                expect(messages.map(function (msg) { return msg.id })).to.eql(msgIds);
            }, done));
        });        
    });
    
    it("#loadMessages with non-existed regId", function (done) {
        queue.loadMessages("non-existed", asyncExpect(function (err, messages) {
            expect(err).not.be.ok();
            expect(messages).be.an(Array);
            expect(messages).to.have.length(0);
        }, done));
    });
    
    it("#removeMessages", function (done) {
        async.timesSeries(5, function (n, next) {
            setTimeout(function () {
                store.createMessage(CONTENT, asyncExpect(function (err, msg) {
                    expect(err).not.be.ok();
                    expect(msg).be.ok();
                    store.enqueueMessage(REGID, msg.id, asyncExpect(function (err, msgRef) {
                        expect(err).not.be.ok();
                        expect(msgRef).be.ok();
                        expect(msgRef.regId).to.eql(REGID);
                        expect(msgRef.msgId).to.eql(msg.id);
                        expect(msgRef.pushedAt).be.ok();
                        next(err, msgRef);
                    }, done, true));                    
                }, done, true));
            }, 10);
        }, function (err, msgRefs) {
            var msgIds = msgRefs.map(function (msgRef) { return msgRef.msgId; });
            queue.loadMessages(REGID, asyncExpect(function (err, messages) {
                expect(err).not.be.ok();
                expect(messages).be.an(Array);
                expect(msgIds.every(function (msgId) {
                            return messages.some(function (msg) { return msg.id == msgId; });
                        })).to.eql(true);
                var removeIds = msgIds.slice(0, 3);
                var remainIds = msgIds.slice(3);
                queue.removeMessages(REGID, removeIds, asyncExpect(function (err) {
                    expect(err).not.be.ok();
                    queue.loadMessages(REGID, asyncExpect(function (err, messages) {
                        expect(err).not.be.ok();
                        expect(messages).be.an(Array);
                        expect(removeIds.some(function (id) {
                                    return messages.some(function (msg) { return msg.id == id; });
                                })).to.eql(false);
                        expect(remainIds.every(function (id) {
                                    return messages.some(function (msg) { return msg.id == id; });
                                })).to.eql(true);
                    }, done));
                }, done, true));
            }, done, true));
        });
    });
    
    it("#update a new registration", function (done) {
        var regId = "newRegId", info = { appKey: "newAppKey", deviceFingerPrint: "newDevice" };
        regs.update(regId, info, asyncExpect(function (err, registration) {
            expect(err).not.be.ok();
            expect(registration).be.ok();
            expect(registration.regId).to.eql(regId);
            expect(registration.appKey).to.eql(info.appKey);
            expect(registration.deviceFingerPrint).to.eql(info.deviceFingerPrint);
        }, done));
    });
    
    it("#update overwrites an existing registration", function (done) {
        var regId = "newRegId", info = { appKey: "newAppKey", deviceFingerPrint: "newDevice" };
        regs.update(regId, info, asyncExpect(function (err, registration) {
            expect(err).not.be.ok();
            expect(registration).be.ok();
            expect(registration.regId).to.eql(regId);
            expect(registration.appKey).to.eql(info.appKey);
            expect(registration.deviceFingerPrint).to.eql(info.deviceFingerPrint);
            
            info.appKey = "newAppKey2";
            regs.update(regId, info, asyncExpect(function (err, registration) {
                expect(err).not.be.ok();
                expect(registration).be.ok();
                expect(registration.regId).to.eql(regId);
                expect(registration.appKey).to.eql(info.appKey);
                expect(registration.deviceFingerPrint).to.eql(info.deviceFingerPrint);
                
                regs.find(regId, asyncExpect(function (err, registration) {
                    expect(err).not.be.ok();
                    expect(registration).be.ok();
                    expect(registration.regId).to.eql(regId);
                    expect(registration.appKey).to.eql(info.appKey);
                    expect(registration.deviceFingerPrint).to.eql(info.deviceFingerPrint);                    
                }, done));
            }, done, true));
        }, done, true));
    });
};
