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

var restler    = require("restler"),
    WebSocket  = require("websocket").client,
    uuid       = require("node-uuid"),
    expect     = require("expect.js"),
    TestHelper = require("../lib/TestHelper"),
    asyncExpect = TestHelper.asyncExpect;

module.exports = {
    regServerUrl: process.env.REGSERVER_URL || "http://localhost:10080",
    
    dispatcherUrl: process.env.DISPATCHER_URL || "http://localhost:10180",
    
    workerUrl: process.env.WORKER_URL || "http://localhost:10280",
    
    integrationEnabled: process.env.INTEGRATION,
    
    describe: function () {
        var condition = TestHelper.when(this.integrationEnabled);
        return condition.describe.apply(condition, arguments);
    },
    
    // Flow helpers
    register: function (opts, callback, done) {
        if (typeof(opts) == "function") {
            done = callback;
            callback = opts;
            opts = {};
        } else if (!opts) {
            opts = {};
        }
        if (!opts.appKey) {
            opts.appKey = uuid.v4();
        }
        if (!opts.deviceFingerPrint) {
            opts.deviceFingerPrint = "DFP-" + uuid.v4();
        }
        
        return restler.postJson(this.regServerUrl + "/register", opts)
                      .on("complete", asyncExpect(function (data, response) {
                                expect(response.statusCode).to.eql(200);
                                expect(data.regId).be.ok();
                                callback(data);
                            }, done, true));
    },
    
    pushMsg: function (content, regIds, callback, done) {
        return restler.postJson(this.dispatcherUrl + "/send", {
                        info: [{
                            message: content,
                            regIds: regIds
                        }]
                    }).on("complete", asyncExpect(function (data, response) {
                                expect(response.statusCode).to.eql(200);
                                expect(data.messageIds).be.an(Array);
                                callback(data);
                            }, done, true));
    },
    
    connect: function (regIds, messageHandler, done) {
        var socket = new WebSocket();
        socket.on("connect", function (conn) {
            conn.on("message", asyncExpect(function (data) {
                expect(data.type).to.eql("utf8");
                var msg = JSON.parse(data.utf8Data);
                messageHandler(msg);
            }, done, true)).sendUTF(JSON.stringify({ event: "addRegId", seq: 0, regIds: regIds }));
        }).connect(this.workerUrl, "msg-json");
        return socket;
    }
};
