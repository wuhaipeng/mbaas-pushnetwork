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

var CachedDataAccessor  = require("./CachedDataAccessor"),
    MongoDbDataAccessor = require("./MongoDbDataAccessor"),
    RedisDataAccessor   = require("./RedisDataAccessor"),
    RedisCacheProvider  = require("./RedisCacheProvider");

function createDataAccessor (connStr) {
    if (connStr.match(/^cached\:/)) {
        var conns = connStr.substr(7).split(',');
        return new CachedDataAccessor(new RedisCacheProvider(conns[0]), createDataAccessor(conns[1]));
    } else if (connStr.match(/^mongodb:/)) {
        return new MongoDbDataAccessor(connStr);
    } else if (connStr.match(/^redis:/)) {
        return new RedisDataAccessor(connStr);
    } else {
        throw new Error("Invalid connection string: " + connStr);
    }
}

exports.createDataAccessor = createDataAccessor;
