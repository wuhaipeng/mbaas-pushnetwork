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

var mongoose = require("mongoose");

var Message = mongoose.model("Message",
    new mongoose.Schema({
        content: String,
        expireAt: Date
    }, {
        toObject: {
            transform: function (doc, ret) {
                ret.id = doc.id.toString();
                delete ret._id;
            }
        }
    }), "messages");

var MsgRef = mongoose.model("MsgRef",
    new mongoose.Schema({
        regId: String,
        message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        pushedAt: Date
    }, {
        toObject: {
            transform: function (doc, ret) {
                ret.msgId = doc.message instanceof Message ? doc.message.id.toString() : (doc.message ? doc.message.toString() : null);
                delete ret._id;
                delete ret.message;
            }
        }
    }), "msgrefs");

var connectionUrl;

module.exports = {
    Message: Message,
    MsgRef: MsgRef,
    connect: function (url) {
        if (!connectionUrl) {
            mongoose.connect(url);
            connectionUrl = url;
        }
    }
};
