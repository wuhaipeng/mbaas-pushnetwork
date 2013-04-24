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

var mongoose = require("mongoose"),
    ObjectId = mongoose.Types.ObjectId,
    Settings = require("./Settings");

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

var Registration = mongoose.model("Registration",
    new mongoose.Schema({
        regId: { type: String, index: { unique: true, required: true } },
        appKey: String,
        deviceFingerPrint: String
    }, {
        id: false,
        toObject: {
            transform: function (doc, ret) {
                delete ret._id;
            }
        }
    }), "registrations");

function msgIdsToObjectIds(msgIds) {
    return msgIds.map(function (msgId) { return new ObjectId(msgId); });
}

var connectionUrl;

module.exports = new Class({
    initialize: function (connUrl) {
        if (!connectionUrl) {
            mongoose.connect(connUrl);
            connectionUrl = connUrl;
        }
    },
    
    createMessage: function (content, expireAt, callback) {
        Message.create({ content: content, expireAt: expireAt }, function (err, message) {
            callback(err, err ? undefined : message.toObject());
        });
        return this;
    },
    
    loadMessage: function (msgId, callback) {
        Message.findById(new ObjectId(msgId), function (err, message) {
            callback(err, err ? undefined : (message ? message.toObject() : null));
        });
        return this;              
    },
    
    createMsgRef: function (regId, msgId, callback) {
        msgId = new ObjectId(msgId);
        MsgRef.create({ regId: regId, message: msgId, pushedAt: new Date() }, function (err, msgRef) {
            callback(err, err ? undefined : msgRef.toObject());
        });
        return this;
    },
    
    loadMsgRefs: function (regId, callback) {
        MsgRef.find({ regId: regId })
              .sort({ pushedAt: -1 })
              .exec(function (err, results) {
                    callback(err, err ? undefined : results.map(function (msgRef) { return msgRef.toObject(); }));
                })
        return this;
    },
    
    removeMsgRefs: function (regId, msgIds, callback) {
        MsgRef.remove({ "$and": [
            { regId: regId },
            { message: { "$in": msgIdsToObjectIds(msgIds) } }
        ]}, callback);
        return this;
    },
    
    saveRegistration: function (regId, appKey, deviceFingerPrint, extra, callback) {
        var reg = { regId: regId, appKey: appKey, deviceFingerPrint: deviceFingerPrint };
        Registration.update({ regId: regId }, reg, { upsert: true }, function (err) {
            callback(err, err ? undefined : reg);
        });
        return this;
    },
    
    findRegistration: function (regId, callback) {
        Registration.findOne({ regId: regId }, function (err, registration) {
            callback(err, err ? undefined : (registration ? registration.toObject() : null));
        });
        return this;
    }
});
