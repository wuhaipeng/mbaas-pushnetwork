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
    TestHelper  = require("../lib/TestHelper"),
    MockedClass = TestHelper.MockedClass,
    asyncExpect = TestHelper.asyncExpect;

describe("commander", function () {
    
    var MockedRedis = new Class({
        Extends: MockedClass,
        Implements: [process.EventEmitter]
    });
    
    function getCommander(mockedRedis) {
        return sandbox.require("../../worker/lib/commander", {
            requires: {
                "pn-common": {
                    Settings: {
                        HEARTBEAT_EXPIRE: 60,
                        HEARTBEAT_PERIOD: 30,
                        connectRedis: function () { return mockedRedis; }
                    }
                }
            }
        }).get();
    }
    
    it("#handlePicks in the right order", function (done) {
        var mockedRedis = new MockedRedis();
        mockedRedis.mock("lrange", function (key, start, end, callback) {
            callback(null, [
                '{ "action": "test", "val": 1 }',
                '{ "action": "test", "val": 2 }',
                '{ "action": "test", "val": 3 }'
            ]);
        });
        mockedRedis.mock("del", function (key, callback) {
            callback();
        });
        
        var handled = [];        
        mockedRedis.mock("brpoplpush", asyncExpect(function () {
            expect(handled).to.eql([3, 2, 1]);
        }, done));

        var commander = getCommander(mockedRedis);
        commander.addCommand("test", function (command, next) {
            handled.push(command.val);
            next();
        });
                
        commander.handlePicks();
    });
    
    it("#handlePicks skips invalid commands", function (done) {
        var mockedRedis = new MockedRedis();
        mockedRedis.mock("lrange", function (key, start, end, callback) {
            callback(null, [
                '{ "action": "test", "val": 1 }',
                'invalid JSON here',
                '{ "action": "test", "val": 3 }'
            ]);
        });
        mockedRedis.mock("del", function (key, callback) {
            callback();
        });
        
        var handled = [];        
        mockedRedis.mock("brpoplpush", asyncExpect(function () {
            expect(handled).to.eql([3, 1]);
        }, done));

        var commander = getCommander(mockedRedis);
        commander.addCommand("test", function (command, next) {
            handled.push(command.val);
            next();
        });
                
        commander.handlePicks();        
    });
});
