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

var ObjectId = require("mongoose").Types.ObjectId,
    Settings = require("./Settings"),
    models = require("./MongooseModels");

var Message = models.Message;
var MsgRef = models.MsgRef;

module.exports = new Class({
    initialize: function (connUrl) {
        models.connect(connUrl);
    },

    loadMessages: function (regId, callback) {
        MsgRef.find({ regId: regId })
              .populate("message")
              .sort({ pushedAt: -1 })
              .limit(Settings.MAX_QUEUEDMSGS)
              .exec(function (err, results) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, results.map(function (msgRef) {
                                return msgRef.message.toObject();
                            }));
                        }
                    });
    },
    
    removeMessages: function (regId, msgIds, callback) {
        MsgRef.remove({ "$and": [
            { regId: regId },
            { msgId: { "$in": msgIds.map(function (msgId) { return new ObjectId(msgId); }) } }
        ]}, callback);
    }
});
