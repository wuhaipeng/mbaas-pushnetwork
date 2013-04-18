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

var ObjectId = require("mongoose").Types.ObjectId;
var Settings = require("./Settings");
var models = require("./MongooseModels");

var Message = models.Message;
var MsgRef = models.MsgRef;

module.exports = new Class({
    initialize: function (connUrl) {
        models.connect(connUrl);
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
        Message.create({ content: content, expireAt: new Date(Date.now() + ttl * 60000) }, function (err, message) {
            callback(err, err ? undefined : message.toObject());
        });
        return this;
    },
    
    enqueueMessage: function (regId, msgId, callback) {
        msgId = new ObjectId(msgId);
        MsgRef.create({ regId: regId, message: msgId, pushedAt: new Date() }, function (err, msgRef) {
            callback(err, err ? undefined : msgRef.toObject());
        });
        return this;
    }
});
