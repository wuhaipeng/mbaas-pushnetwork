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

describe("RegServer", function () {
    
    function newApp(mockedRegs) {
        var app = new MockedApp();
        sandbox.require("../../regserver/routes/api", {
            requires: {
                "pn-common": {
                    Settings: {
                        registrations: mockedRegs
                    }
                }
            }
        }).register(app);
        return app;
    }
    
    describe("Api", function () {
        it("#register a new device", function (done) {
            var mockedRegs = new MockedClass();
            mockedRegs.mock("update", function (regId, info, callback) {
                info.regId = regId;
                callback(null, info);
            });
            var appKey = "appKey", deviceFingerPrint = "deviceFingerPrint";
            newApp(mockedRegs).request("/register", {
                appKey: appKey,
                deviceFingerPrint: deviceFingerPrint
            }, asyncExpect(function (statusCode, data) {
                expect(statusCode).to.eql(200);
                expect(data).be.ok();
                expect(data.regId).be.ok();
                expect(data.appKey).to.eql(appKey);
                expect(data.deviceFingerPrint).to.eql(deviceFingerPrint);
            }, done));
        });
        
        it("#register with an error", function (done) {
            var mockedRegs = new MockedClass();
            mockedRegs.mock("update", function (regId, info, callback) {
                callback(new Error("SomeError"));
            });
            newApp(mockedRegs).request("/register", {
                appKey: "appKey",
                deviceFingerPrint: "deviceFingerPrint"
            }, asyncExpect(function (statusCode, data) {
                expect(statusCode).to.eql(500);
                expect(data).be.ok();
                expect(data.error).be.ok();
                expect(data.error.message).to.eql("SomeError");
            }, done));
        });
        
        it("#register without a valid appKey", function (done) {
            newApp(new MockedClass()).request("/register", {
                deviceFingerPrint: "deviceFingerPrint"
            }, asyncExpect(function (statusCode, data) {
                expect(statusCode).to.eql(400);
                expect(data).be.ok();
                expect(data.msg).to.contain("appKey");
                expect(data.error).be.ok();
                expect(data.error.message).to.eql("BadParameter");
            }, done));            
        });
        
        it("#register without a valid deviecFingerPrint", function (done) {
            newApp(new MockedClass()).request("/register", {
                appKey: "appKey"
            }, asyncExpect(function (statusCode, data) {
                expect(statusCode).to.eql(400);
                expect(data).be.ok();
                expect(data.msg).to.contain("deviceFingerPrint");
                expect(data.error).be.ok();
                expect(data.error.message).to.eql("BadParameter");
            }, done));            
        })

    });
});
