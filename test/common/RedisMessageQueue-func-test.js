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

require("../lib/TestHelper").when(process.env.REDIS_CONN)
    .describe("RedisMessageQueue", function () {
        var RedisDataAccessor = require("../../common/lib/RedisDataAccessor");

        var Factory = new Class({
            createDataAccessor: function () {
                return new RedisDataAccessor(process.env.REDIS_CONN);
            }
        });
        
        require("./CommonTests").MessageQueueTests(new Factory());
    });
