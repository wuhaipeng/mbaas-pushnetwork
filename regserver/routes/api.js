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

exports.register = function (app, db) {

    function getRegistrationId(appKey, deviceFingerprint) {
        var shasum = require("crypto").createHash("sha1");
        shasum.update(appKey);
        shasum.update(deviceFingerprint);
        return shasum.digest("hex");
    }

    app.post("/register", function (req, res) {

        res.set("Content-Type", "application/json");

        var message = {};
        var appKey = req.body.appKey;
        var deviceFingerprint = req.body.deviceFingerprint;

        if (!appKey) {
            message.msg = "App key missed.";
            res.send(400, JSON.stringify(message));
            return;
        }

        if (!deviceFingerprint) {
            message.msg = "Device fingerprint missed.";
            res.send(400, JSON.stringify(message));
            return;
        }

        message.regId = getRegistrationId(appKey, deviceFingerprint);

        db.update(message.regId, appKey, deviceFingerprint, function(err) {
            if (err) {
                res.send(500);
            } else {
                res.send(200, JSON.stringify(message));
            }
        });

    });
};
