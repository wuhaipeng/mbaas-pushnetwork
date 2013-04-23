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

var async = require("async"),
    Settings = require("pn-common").Settings;

var Messenger = new Class({
    initialize: function () {
        this.redis = Settings.connectRedis();
        this.store = Settings.messageStore;
    },
    
    post: function (content, regIds, callback) {
        this.store.createMessage(content, function (err, message) {
            var failedRegIds = [];
            if (err) {
                callback(err);
            } else {
                async.each(regIds, function (regId, next) {
                    this.store.enqueueMessage(regId, message.id, function (err, msgRef) {
                        if (err) {
                            failedRegIds.push(regId);
                            next();
                        } else {
                            this.redis.hget(regId + ":s", "worker.name", function (err, value) {
                                if (!err && value) {
                                    var key = value + ":q";
                                    this.redis.multi()
                                            .lpush(key, JSON.stringify({ action: "push", regId: regId, msgId: message.id }))
                                            .expire(key, Settings.HEARTBEAT_EXPIRE)
                                            .exec(function () { });
                                }
                                next();
                            }.bind(this));
                        }
                    }.bind(this));
                }.bind(this), function () {
                    callback(null, message, failedRegIds);
                });
            }
        }.bind(this));
        return this;
    }
});

var theMessenger;

exports.get = function () {
    if (!theMessenger) {
        theMessenger = new Messenger();
    }
    return theMessenger;
};
