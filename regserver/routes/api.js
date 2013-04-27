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

var Settings = require("pn-common").Settings,
    trace    = Settings.tracer("pn:regs:apis"),
    regidgen = require("../lib/regidgen");

exports.register = function (app) {
    app.post("/register", function (req, res) {
        trace("/register %j", req.body);
        if (!req.body.appKey) {
            res.json(400, { msg: "appKey missed", error: new Error("BadParameter") });
        } else if (!req.body.deviceFingerPrint) {
            res.json(400, { msg: "deviceFingerPrint missed", error: new Error("BadParameter") });
        } else {
            var info = {
                appKey: req.body.appKey,
                deviceFingerPrint: req.body.deviceFingerPrint
            };
            var regId = regidgen.id(info.appKey, info.deviceFingerPrint);
            trace("regId: %s", regId);
            Settings.registrations.update(regId, info, function (err, registration) {
                if (err) {
                    res.json(500, { error : err });
                } else {
                    res.json(200, registration);
                }
            });
        }
    });
};
