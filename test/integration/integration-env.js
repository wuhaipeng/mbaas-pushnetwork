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

var TestHelper = require("../lib/TestHelper");

module.exports = {
    regServerUrl: process.env.REGSERVER_URL || "http://localhost:10080",
    
    dispatcherUrl: process.env.DISPATCHER_URL || "http://localhost:10180",
    
    workerUrl: process.env.WORKER_URL || "http://localhost:10280",
    
    integrationEnabled: process.env.INTEGRATION,
    
    describe: function () {
        var condition = TestHelper.when(this.integrationEnabled);
        return condition.describe.apply(condition, arguments);
    }
};
