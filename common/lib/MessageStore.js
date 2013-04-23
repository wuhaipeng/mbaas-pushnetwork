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
        this.settings = require("./Settings");
    },

    createMessage: function (content, options, callback) {
        if (typeof(options) == "function") {
            callback = options;
            options = {};
        }
        var ttl = options.ttl || this.settings.MAX_TTL;
        if (ttl > this.settings.MAX_TTL) {
            ttl = this.settings.MAX_TTL;
        }
        var expireAt = new Date(Date.now() + ttl * 60000);
        this.accessor.createMessage(content, expireAt, callback);
        return this;
    },
    
    enqueueMessage: function (regId, msgId, callback) {
        var accessor = this.accessor, createdMsgRef, allMsgRefs;
        async.series([
            function (next) {
                accessor.createMsgRef(regId, msgId, function (err, msgRef) {
                    createdMsgRef = msgRef;
                    next(err);
                });
            },
            function (next) {
                accessor.loadMsgRefs(regId, function (err, msgRefs) {
                    allMsgRefs = msgRefs;
                    next(err);
                });
            },
            function (next) {
                if (Array.isArray(allMsgRefs) && allMsgRefs.length > this.settings.MAX_QUEUEDMSGS) {
                    accessor.removeMsgRefs(regId,
                                    allMsgRefs.slice(this.settings.MAX_QUEUEDMSGS)
                                              .map(function (msgRef) { return msgRef.msgId; }),
                                    function () { });
                }
                next();
            }.bind(this)
        ], function (err) {
            callback(err, createdMsgRef);
        });
        return this;
    }
});
