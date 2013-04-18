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

var RedisHelper = require("./RedisHelper");

module.exports = new Class({
    initialize: function (connUrl) {
        this.client = RedisHelper.connect(connUrl);
    },
    
    loadMessages: function (regId, callback) {
        this.client.hgetall(regId, function (err, hash) {
            if (err) {
                callback(err);
            } else {
                var msgRefs = [];
                if (Array.isArray(hash)) {
                    for (var i = 0; i < hash.length / 2; i ++) {
                        msgRefs.push({
                            regId: regId,
                            msgId: hash[i * 2],
                            pushedAt: new Date(parseInt(hash[i * 2 + 1]))
                        });
                    }
                }
                callback(err, msgRefs);
            }
        });
        return this;
    },
    
    removeMessages: function (regId, msgIds, callback) {
        this.client.hdel(regId, msgIds, callback);
    }
});
