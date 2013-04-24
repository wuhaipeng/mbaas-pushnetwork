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
    MockedApp   = require("../lib/MockedApp"),
    TestHelper  = require("../lib/TestHelper"),
    MockedClass = TestHelper.MockedClass,
    asyncExpect = TestHelper.asyncExpect;

describe("Dispatcher", function () {
    
    function newApp(mockedMessenger) {
        var app = new MockedApp();
        sandbox.require("../../dispatcher/routes/api", {
            requires: {
                "pn-common": {
                    Settings: {
                        MAX_REGIDS_INREQ: 10
                    }
                },
                "../lib/messenger": {
                    get: function () { return mockedMessenger; }
                }
            }
        }).register(app);
        return app;
    }
    
    describe("Api", function () {
        it("#send messages all succeeded", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                callback(null, { id: (++ messageId).toString(), content: message }, []);
            });
            newApp(messenger).request("/send", { info: [
                    { message: "content1", regIds: ["a", "b", "c"] },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data).to.eql({ messageIds: ["1", "2"] });
                }, done));
        });
        
        it("#send messages with some regIds invalid", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                callback(null, { id: (++ messageId).toString(), content: message },
                        regIds.filter(function (regId) { return regId.match(/\:f$/); }));
            });
            newApp(messenger).request("/send", { info: [
                    { message: "content1", regIds: ["a", "b:f", "c:f"] },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data).to.eql({ messageIds: [{ msgId: "1", failedRegIds: ["b:f", "c:f"] }, "2"] });
                }, done));
        });
        
        it("#send messages with some failed", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                var id = ++ messageId;
                if (id == 2) {
                    callback(new Error("ErrorMessage"));
                } else {
                    callback(null, { id: id.toString(), content: message }, []);
                }
            });
            newApp(messenger).request("/send", { info: [
                    { message: "content1", regIds: ["a", "b", "c"] },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data.messageIds).be.an(Array);
                    expect(data.messageIds).to.have.length(2);
                    expect(data.messageIds[0]).to.eql("1");
                    expect(data.messageIds[1].error).be.ok();
                    expect(data.messageIds[1].error.message).to.eql("ErrorMessage");
                }, done));
        });
        
        it("#send messages with too many registration Ids", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                callback(null, { id: (++ messageId).toString(), content: message }, []);
            });        
            newApp(messenger).request("/send", { info: [
                    { message: "content1", regIds: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11"] },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data.messageIds).be.an(Array);
                    expect(data.messageIds).to.have.length(2);
                    expect(data.messageIds[0].error).be.ok();
                    expect(data.messageIds[0].error.message).to.eql("TooManyRegIds");
                    expect(data.messageIds[1]).to.eql("1");                
                }, done));
        });
        
        it("#send messages without message content", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                callback(null, { id: (++ messageId).toString(), content: message }, []);
            });        
            newApp(messenger).request("/send", { info: [
                    { regIds: ["a", "b", "c"] },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data.messageIds).be.an(Array);
                    expect(data.messageIds).to.have.length(2);
                    expect(data.messageIds[0].error).be.ok();
                    expect(data.messageIds[0].error.message).to.eql("BadFormat");
                    expect(data.messageIds[1]).to.eql("1");                
                }, done));
        });
        
        it("#send messages with invalid registration Ids", function (done) {
            var messenger = new MockedClass();
            var messageId = 0;
            messenger.mock("post", function (message, regIds, callback) {
                callback(null, { id: (++ messageId).toString(), content: message }, []);
            });        
            newApp(messenger).request("/send", { info: [
                    { message: "content1", regIds: "abc" },
                    { message: "content2", regIds: ["d"] }
                ] }, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(200);
                    expect(data.messageIds).be.an(Array);
                    expect(data.messageIds).to.have.length(2);
                    expect(data.messageIds[0].error).be.ok();
                    expect(data.messageIds[0].error.message).to.eql("BadFormat");
                    expect(data.messageIds[1]).to.eql("1");                
                }, done));        
        });
        
        it("#send messages with invalid payload", function (done) {
            newApp(new MockedClass()).request("/send", {}, asyncExpect(function (statusCode, data) {
                    expect(statusCode).to.eql(400);
                    expect(data.error).be.ok();
                    expect(data.error.message).to.eql("BadParameter");
                }, done));
        });
    });
});
