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

module.exports = new Class({
    initialize: function (cacheProvider, messageQueue) {
        this.cacheProvider = cacheProvider;
        this.messageQueue = messageQueue;
    },
    
    loadMessages: function (regId, callback) {
        var key = "q:" + regId;
        this.cacheProvider.getValue(key, function (err, value) {
            var messages = undefined;
            if (!err && value) {
                try {
                    messages = JSON.parse(value);
                } catch (e) {
                    console.log("Bad value in cache: " + key + "=" + value);
                    this.cacheProvider.setValue(key);
                }
            }
            if (messages == undefined) {
                this.messageQueue.loadMessages(regId, function (err, msgs) {
                    if (!err && msgs) {
                        this.cacheProvider.setValue(key, JSON.stringify(msgs));
                    }
                    callback(err, msgs);
                }.bind(this));
            } else {
                callback(err, messages);
            }
        }.bind(this));
        return this;
    },
    
    removeMessages: function (regId, msgIds, callback) {
        this.cacheProvider.setValue("q:" + regId);
        this.messageQueue.removeMessages(regId, msgIds, callback);
        return this;
    }
});
