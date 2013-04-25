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

var async     = require("async"),
    Settings  = require("pn-common").Settings,
    trace     = Settings.tracer("pn:disp:api"),
    messenger = require("../lib/messenger");

exports.register = function (app) {
    app.post("/send", function (req, res) {
        trace("/send %j", req.body);
        if (Array.isArray(req.body.info)) {
            async.map(req.body.info, function (parcel, done) {
                if (typeof(parcel.message) == "string" && Array.isArray(parcel.regIds)) {
                    if (parcel.regIds.length <= Settings.MAX_REGIDS_INREQ) {
                        messenger.get().post(parcel.message, parcel.regIds, function (err, message, failedRegIds) {
                            if (err) {
                                done(null, { error: err.message });
                            } else if (failedRegIds.length > 0) {
                                done(null, { msgId: message.id, failedRegIds: failedRegIds });
                            } else {
                                done(null, message.id);
                            }
                        });
                    } else {
                        done(null, { error: "TooManyRegIds" });
                    }
                } else {
                    done(null, { error: "BadFormat" });
                }
            }, function (err, msgIds) {
                trace("messageIds: %j", msgIds);
                res.json({ messageIds: msgIds });
            });
        } else {
            res.json(400, { error: "BadParameter" });
        }
    });
};
