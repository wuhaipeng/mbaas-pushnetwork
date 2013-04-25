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
    restler = require("restler"),
    io      = require("socket.io-client"),
    uuid    = require("node-uuid"),
    ienv    = require("./integration-env"),
    TestHelper  = require("../lib/TestHelper"),
    asyncExpect = TestHelper.asyncExpect;

ienv.describe("SimpleFlow", function () {
    var DEVICEFP = "DummyDeviceFingerPrint";
    var CONTENT = "TESTMESSAGECONTENT";
    
    function register(regInfo, callback) {
        restler.postJson(ienv.regServerUrl + "/register", regInfo)
            .on("complete", callback);
    }
    
    it("simplest message dispatch", function (done) {
        var regId, msgId, pushedMsgs;

        var validateMessage = asyncExpect(function () {
            var content;
            expect(pushedMsgs.some(function (msg) {
                    if (msg.id == msgId) {
                        content = msg.content;
                        return true;
                    } else {
                        return false;
                    }
                })).to.eql(true);
            expect(content).to.eql(CONTENT);
        }, done);
        
        register({ appKey: uuid.v4(), deviceFingerPrint: DEVICEFP }, asyncExpect(function (data, response) {
            expect(response.statusCode).to.eql(200);
            expect(data.regId).be.ok();
            regId = data.regId;            
        }, done, true));
        var socket = io.connect(ienv.workerUrl);
        socket.on("connect", function () {
            socket.emit("addRegId", JSON.stringify({ seq: 0, regIds: [regId] }));
            socket.on("push", asyncExpect(function (data) {
                var info = JSON.parse(data).info;
                expect(info).be.an(Array);
                var msgs = info.filter(function (msg) { return msg.regId == regId; });
                expect(msgs).not.be.empty();
                expect(msgs[0].messages).not.be.empty();
                pushedMsgs = msgs[0].messages;
                if (msgId) {
                    validateMessage();
                }
            }, done, true));            
            restler.postJson(ienv.dispatcherUrl + "/send", {
                    info: [{
                        message: CONTENT,
                        regIds: [regId]
                    }]
                })
                .on("complete", asyncExpect(function (data, response) {
                    expect(response.statusCode).to.eql(200);
                    expect(data.messageIds).be.an(Array);
                    expect(data.messageIds).to.have.length(1);
                    expect(typeof(data.messageIds[0])).to.eql("string");
                    msgId = data.messageIds[0];
                    if (pushedMsgs) {
                        validateMessage();
                    }
                }, done, true));
        });
    });
});