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
    ienv   = require("./integration-env"),
    asyncExpect = require("../lib/TestHelper").asyncExpect;

require("../lib/TestHelper")
    .when(ienv.integrationEnabled && process.env.STRESS)
    .describe("MassPush", function () {

    function massPush(appCount, msgCount, done) {
        var regIds = {}, count = 0;
        async.times(appCount, function (n, next) {
            ienv.register(function (data) {
                var regId = data.regId;
                regIds[regId] = { msgs: [] }
                ienv.connect([regId], function (msg) {
                    if (msg.event != "push") {
                        return;
                    }
                    expect(msg.info).be.an(Array);
                    var msgs = msg.info.filter(function (msg) { return msg.regId == regId; });
                    expect(msgs).not.be.empty();
                    msgs.forEach(function (msg) {
                        regIds[regId].msgs = regIds[regId].msgs.concat(msg.messages);
                        count += msg.messages.length;
                    });
                    
                    if (count == appCount * msgCount) {
                        done();
                    }
                }, done).on("connect", function () { process.nextTick(next); });
            }, done);
        }, asyncExpect(function () {
            expect(Object.keys(regIds)).to.have.length(appCount);
            async.times(msgCount, function (n, next) {
                ienv.pushMsg("content-" + n, Object.keys(regIds), function (data) {
                    expect(data.messageIds.every(function (val) { return typeof(val) == "string"; })).to.eql(true);
                }, done);
            });
        }, done, true));        
    }
    
    it("push 20 messages to 20 apps", function (done) {
        this.timeout(60000);
        massPush(20, 20, done);
    });
});
