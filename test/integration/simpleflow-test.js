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
    ienv   = require("./integration-env");

ienv.describe("SimpleFlow", function () {
    var CONTENT = "TESTMESSAGECONTENT";
    
    it("simplest message dispatch", function (done) {
        var regId, msgId, pushedMsgs;

        var validateMessage = function () {
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
            done();
        };
        
        ienv.register(function (data) {
            regId = data.regId;            

            ienv.connect([regId], function (msg) {
                if (msg.event == 'state') {
                    expect(msg.regIds).be.an(Array);
                    expect(msg.regIds.indexOf(regId)).not.be.lessThan(0);
                    ienv.pushMsg(CONTENT, [regId], function (data) {
                        expect(data.messageIds).to.have.length(1);
                        expect(typeof(data.messageIds[0])).to.eql("string");
                        msgId = data.messageIds[0];
                        if (pushedMsgs) {
                            validateMessage();
                        }
                    }, done);                       
                } else if (msg.event == "push") {
                    expect(msg.info).be.an(Array);
                    var msgs = msg.info.filter(function (msg) { return msg.regId == regId; });
                    expect(msgs).not.be.empty();
                    expect(msgs[0].messages).not.be.empty();
                    pushedMsgs = msgs[0].messages;
                    if (msgId) {
                        validateMessage();
                    }
                }
            }, done).on("connect", function (conn) {
                setTimeout(function () {
                    conn.sendUTF(JSON.stringify({ event: "state", seq: 100 }));
                }, 50);
            });
        }, done);
    });
});