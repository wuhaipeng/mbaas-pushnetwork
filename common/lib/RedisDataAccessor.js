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

var uuid  = require("node-uuid"),
    RedisHelper = require("./RedisHelper");

module.exports = new Class({
    initialize: function (connUrl) {
        this.client = RedisHelper.connect(connUrl);
    },

    createMessage: function (content, expireAt, callback) {
        var message = {
            id: uuid.v4(),
            content: content,
            expireAt: expireAt
        };
        var expiration = Math.floor((expireAt.valueOf() - Date.now()) / 1000);
        if (expiration <= 0) {
            expiration = 0;
        }
        this.client.setex("m:" + message.id, expiration, JSON.stringify(message), function (err) {
            callback(err, err ? undefined : message);
        });
        return this;
    },
    
    loadMessage: function (msgId, callback) {
        this.client.get("m:" + msgId, function (err, data) {
            if (err) {
                callback(err);
            } else {
                var message = null;
                try {
                    if (data) {
                        message = JSON.parse(data);
                    }
                } catch (e) {
                    // ignored
                }
                callback(null, message);
            }
        });
    },

    createMsgRef: function (regId, msgId, callback) {
        var pushedAt = new Date();
        this.client.zadd("q:" + regId, pushedAt.valueOf(), msgId, function (err) {
            callback(err, err ? undefined : {
                regId: regId,
                msgId: msgId,
                pushedAt: pushedAt
            });
        });
        return this;
    },
    
    loadMsgRefs: function (regId, callback) {
        this.client.zrevrange("q:" + regId, 0, -1, "WITHSCORES", function (err, values) {
            if (err) {
                callback(err);
            } else {
                var msgRefs = [];
                if (Array.isArray(values)) {
                    for (var i = 0; i < values.length; i += 2) {
                        if (values[i + 1]) {
                            msgRefs.push({
                                regId: regId,
                                msgId: values[i],
                                pushedAt: new Date(parseInt(values[i + 1]))
                            });
                        }
                    }
                }
                callback(null, msgRefs);
            }
        });
        return this;
    },
    
    removeMsgRefs: function (regId, msgIds, callback) {
        this.client.zrem.apply(this.client, ["q:" + regId].concat(msgIds).concat([callback]));
        return this;
    },
    
    saveRegistration: function (regId, appKey, deviceFingerPrint, extra, callback) {
        var registration = {
            regId: reg
        }
        this.client.hmset("r:" + regId, {
                appKey: appKey,
                deviceFingerPrint: deviceFingerPrint
        }, function (err) {
            callback(err, err ? undefined : {
                regId: regId,
                appKey: appKey,
                deviceFingerPrint: deviceFingerPrint
            });
        });
        return this;
    },
    
    findRegistration: function (regId, callback) {
        this.client.hgetall("r:" + regId, function (err, data) {
            if (err) {
                callback(err);
            } else {
                if (data) {
                    data.regId = regId;
                }
                callback(null, data);
            }
        });
        return this;
    }
});
