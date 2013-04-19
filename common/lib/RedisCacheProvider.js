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

// This module implements a cache provider based on Redis

var RedisHelper = require("./RedisHelper");

module.exports = new Class({
    initialize: function (connUrl) {
        this.client = RedisHelper.connect(connUrl, { cache: true });
    },
    
    getValue: function (key, callback) {
        this.client.get(key, callback);
        return this;
    },
    
    setValue: function (key, value, expireAt, callback) {
        if (typeof(expireAt) == "function") {
            callback = expireAt;
            expireAt = null;
        } else if (typeof(value) == "function") {
            callback = value;
            value = undefined;
        }
        // fixup expireAt on seconds
        var expiration = expireAt instanceof Date ? Math.floor(expireAt.valueOf() / 1000) : null;
        if (value == undefined) {
            this.client.del(key, callback);
        } else if (value == null) {        // only update expiration
            if (expiration) {
                this.client.expireat(key, expiration, callback);
            } else {                // set expiration to null for being never expired
                this.client.persist(key, callback);
            }
        } else if (expiration) {    // update value and expiration
            // this should be done with MULTI for consistency
            this.client.multi()
                        .set(key, value)
                        .expireat(key, expiration)
                        .exec(callback);
        } else {                    // update value which never expires
            this.client.set(key, value, callback);
        }
        return this;
    }
});
