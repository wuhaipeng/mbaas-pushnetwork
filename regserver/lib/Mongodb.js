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

var regSchema = new mongoose.Schema({
    regId: { type: String, index: { unique: true, required: true } },
    appKey: { type: String },
    deviceFingerprint: { type: String },
    lastUpdateAt: { type: Date }
}, { id: false });

regSchema.methods.toDataObject = function () {
    return {
        regId: this.regId,
        appKey: this.appKey,
        deviceFingerprint: this.deviceFingerprint,
        lastUpdateAt: this.lastUpdateAt
    };
};

var Reg = mongoose.model("Reg", regSchema, "regs");

module.exports = new Class({

    initialize: function (url) {
        this.url = url;
    },

    ready: function (callback) {
        mongoose.connect(this.url, function(err) {
            callback(err);
        });
    },
        
    update: function (regid, appkey, devicefingerprint, callback) {
        Reg.findOne({ regId: regid }).exec(function(err, result) {
          if (!err) {
              if (result) {
                  result.lastUpdateAt = new Date();
                  result.save(function (e) {
                      callback(e);
                  });
                  return;
              }
              var reg = new Reg({
                  regId: regid,
                  appKey: appkey,
                  deviceFingerprint: devicefingerprint,
                  lastUpdateAt: new Date()
              });
              reg.save(function (e) {
                  callback(e);
              });
              return;
          }
          callback(err);
        });
    }
});
