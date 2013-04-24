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

var async = require("async");

module.exports = new Class({
    initialize: function (dataAccessor) {
        this.accessor = dataAccessor;
    },

    loadMessages: function (regId, msgIds, callback) {
        if (typeof(msgIds) == "function") {
            callback = msgIds;
            msgIds = null;
        }
        this.accessor.loadMsgRefs(regId, function (err, msgRefs) {
            if (err) {
                callback(err);
            } else if (Array.isArray(msgRefs)) {
                if (Array.isArray(msgIds)) {
                    msgRefs = msgRefs.filter(function (msgRef) {
                        return msgIds.indexOf(msgRef.msgId) >= 0;
                    });
                }
                async.map(msgRefs,
                        function (msgRef, next) {
                            this.accessor.loadMessage(msgRef.msgId, function (err, message) {
                                if (!err && message) {
                                    message.pushedAt = msgRef.pushedAt;
                                }
                                next(err, message);
                            });
                        }.bind(this),
                        callback
                );
            } else {
                callback(null, null);
            }
        }.bind(this));
        return this;
    },
    
    removeMessages: function (regId, msgIds, callback) {
        this.accessor.removeMsgRefs(regId, msgIds, callback);
    }
});
