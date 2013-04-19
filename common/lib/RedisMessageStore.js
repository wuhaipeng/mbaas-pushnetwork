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

var RedisHelper = require("./RedisHelper"),
    Settings = require("./Settings"),
    uuid = require("node-uuid");

module.exports = new Class({
    initialize: function (connUrl) {
        this.client = RedisHelper.connect(connUrl);
    },
    
    createMessage: function (content, options, callback) {
        if (typeof(options) == "function") {
            callback = options;
            options = {};
        }
        var ttl = options.ttl || Settings.MAX_TTL;
        if (ttl > Settings.MAX_TTL) {
            ttl = Settings.MAX_TTL;
        }
        var expiration = ttl * 60;
        var message = {
            id: uuid.v4(),
            content: content,
            expireAt: new Date(Date.now() + expiration * 1000)
        };
        this.client.setex(message.id, expiration, JSON.stringify(message), function (err) {
            callback(err, err ? undefined : message);
        });
        return this;
    },
    
    enqueueMessage: function (regId, msgId, callback) {
        var pushedAt = new Date();
        this.client.hset(regId, msgId, pushedAt.valueOf(), function (err) {
            callback(err, err ? undefined : {
                regId: regId,
                msgId: msgId,
                pushedAt: pushedAt
            });
        });
        return this;
    }
});
