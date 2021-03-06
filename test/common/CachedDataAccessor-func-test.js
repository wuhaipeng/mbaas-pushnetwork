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

require("../lib/TestHelper").when(process.env.MONGODB_CONN && process.env.REDIS_CONN)
    .describe("CachedDataAccessor", function () {
        var CachedDataAccessor  = require("../../common/lib/CachedDataAccessor");
        var MongoDbDataAccessor = require("../../common/lib/MongoDbDataAccessor");
        var RedisCacheProvider  = require("../../common/lib/RedisCacheProvider");

        var Factory = new Class({
            createDataAccessor: function () {
                return new CachedDataAccessor(new RedisCacheProvider(process.env.REDIS_CONN), new MongoDbDataAccessor(process.env.MONGODB_CONN));
            }
        });
        
        require("./CommonTests")(new Factory());
    });
