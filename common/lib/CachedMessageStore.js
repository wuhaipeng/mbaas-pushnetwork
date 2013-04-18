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
    
    initialize: function (cacheProvider, messageStore) {
        this.cacheProvider = cacheProvider;
        this.messageStore = messageStore;
    },
    
    createMessage: function (content, options, callback) {
        this.messageStore.createMessage(content, options, function (err, message) {
            if (!err && message) {
                this.cacheProvider.setValue("m:" + message.id, JSON.stringify(message), message.expireAt, function () { });
            }
            callback(err, message);
        }.bind(this));
        return this;
    },
    
    enqueueMessage: function (regId, msgId, callback) {
        this.messageStore.enqueueMessage(regId, msgId, callback);
        this.cacheProvider.setValue("q:" + regId);
        return this;
    }
});
