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

function decodeObject(data) {
    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

module.exports = new Class({
    initialize: function (cacheProvider, dataAccessor) {
        this.cache = cacheProvider;
        this.accessor = dataAccessor;
    },

    createMessage: function (content, expireAt, callback) {
        this.accessor.createMessage(content, expireAt, function (err, message) {
            if (!err && message) {
                this.cache.setValue("cache:m:" + message.id, JSON.stringify(message), expireAt, function () {
                    callback(err, message);
                });
            } else {
                callback(err, message);
            }
        }.bind(this));
        return this;
    },
    
    loadMessage: function (msgId, callback) {
        this.cache.getValue("cache:m:" + msgId, function (err, data) {
            var object = !err && data ? decodeObject(data) : null;
            if (!object) {
                this.accessor.loadMessage(msgId, function (err, message) {
                    if (!err && message) {
                        this.cache.setValue("cache:m:" + message.id, JSON.stringify(message), message.expireAt, function () {
                            callback(err, message);
                        });
                    } else {
                        callback(err, message);
                    }
                }.bind(this));
            } else {
                callback(null, object);
            }
        }.bind(this));
        return this;
    },

    createMsgRef: function (regId, msgId, callback) {
        this.accessor.createMsgRef(regId, msgId, function (err, msgRef) {
            this.cache.setValue("cache:q:" + regId, function () {
                callback(err, msgRef);
            });
        }.bind(this));
        return this;
    },
    
    loadMsgRefs: function (regId, callback) {
        this.cache.getValue("cache:q:" + regId, function (err, data) {
            var object = !err && data ? decodeObject(data) : null;
            if (!object) {
                this.accessor.loadMsgRefs(regId, function (err, msgRefs) {
                    if (!err && msgRefs) {
                        this.cache.setValue("cache:q:" + regId, JSON.stringify(msgRefs), function () {
                            callback(err, msgRefs);
                        });
                    } else {
                        callback(err, msgRefs);
                    }
                }.bind(this));
            } else {
                callback(null, object);
            }
        }.bind(this));
        return this;
    },
    
    removeMsgRefs: function (regId, msgIds, callback) {
        this.accessor.removeMsgRefs(regId, msgIds, function (err) {
            this.cache.setValue("cache:q:" + regId, function () {
                callback(err);
            });
        }.bind(this));
        return this;
    },
    
    saveRegistration: function (regId, appKey, deviceFingerPrint, extra, callback) {
        this.accessor.saveRegistration(regId, appKey, deviceFingerPrint, extra, function (err, registration) {
            if (!err && registration) {
                this.cache.setValue("cache:r:" + regId, JSON.stringify(registration), function () {
                    callback(err, registration);
                });
            } else {
                callback(err, registration);
            }
        }.bind(this));
        return this;
    },
    
    findRegistration: function (regId, callback) {
        this.cache.getValue("cache:r:" + regId, function (err, data) {
            var object = !err && data ? decodeObject(data) : null;
            if (!object) {
                this.accessor.findRegistration(regId, function (err, registration) {
                    if (!err && registration) {
                        this.cache.setValue("cache:r:" + regId, JSON.stringify(registration), function () {
                            callback(err, registration);
                        });
                    } else {
                        callback(err, registration);
                    }
                }.bind(this));
            } else {
                callback(null, object);
            }
        }.bind(this));
        return this;
    }
});
