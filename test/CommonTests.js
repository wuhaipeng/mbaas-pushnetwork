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
    asyncExpect = require("./TestHelper").asyncExpect;

exports.MessageStoreTests = function (factory) {

    var CONTENT = "Dummy Message Content";
    var DEFAULT_TTL = 43200;
    var REGID = "Dummy Reg Id";
    
    var store;
    
    before(function () {
        store = factory.createMessageStore();
    });
    
    it("#createMessage with default TTL", function (done) {
        var now = new Date();
        store.createMessage(CONTENT, asyncExpect(function (err, message) {
            expect(err).be(null);
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
            expect(err).be(null);
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
            expect(err).be(null);
            expect(message).be.ok();
            store.enqueueMessage(REGID, message.id, asyncExpect(function (err, msgRef) {
                expect(err).be(null);
                expect(msgRef).be.ok();
                expect(msgRef.regId).to.eql(REGID);
                expect(msgRef.msgId).to.eql(message.id);
                expect(msgRef.pushedAt).be.ok();
            }, done));
        }, done, true));
    });
};

exports.MessageQueueTests = function (factory) {
    
    var store, queue;
    
    before(function () {
        store = factory.createMessageStore();
        queue = factory.createMessageQueue();
    });
    
    it("#loadMessages with non-existed regId", function (done) {
        queue.loadMessages("non-existed", asyncExpect(function (err, messages) {
            expect(err).be(null);
            expect(messages).be.an(Array);
            expect(messages).to.have.length(0);
        }, done));
    });
};
