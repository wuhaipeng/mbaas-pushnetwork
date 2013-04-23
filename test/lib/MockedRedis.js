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

var MockedClass = require("./TestHelper").MockedClass;

var MockedMulti = new Class({
    Extends: MockedClass,
    
    initialize: function (redis) {
        this.redis = redis;
    },
    
    hmset: function (key, hash) {
        if (!this.redis.data[key]) {
            this.redis.data[key] = { };
        }
        Object.keys(hash).forEach(function (field) {
            this.redis.data[key][field] = hash[field];
        }, this);
        return this;
    },
    
    del: function (key) {
        delete this.redis.data[key];
        return this;
    },
    
    lpush: function (key, value) {
        if (!Array.isArray(this.redis.data[key])) {
            this.redis.data[key] = [];
        }
        this.redis.data[key].unshift(value);
        return this;
    },
    
    expire: function () {
        return this;
    },
    
    exec: function (callback) {
        process.nextTick(callback);
        return this;
    }
});

var MockedRedis = new Class({
    Extends: MockedClass,
    Implements: [process.EventEmitter],
    
    initialize: function () {
        this.data = { };
    },
    
    hget: function (key, field, callback) {
        process.nextTick(function () {
            callback(null, this.data[key] ? this.data[key][field] : null);
        }.bind(this));
        return this;
    },
    
    hmget: function () {
        var key = arguments[0];
        var callback = arguments[arguments.length - 1];
        var fields = [].slice.call(arguments, 1, -1);
        process.nextTick(function () {
            var values = fields.map(function (field) {
                return this.data[key] ? this.data[key][field] : null;
            }.bind(this));
            callback(null, values);
        }.bind(this));
        return this;
    },

    watch: function (key, callback) {
        process.nextTick(callback);
        return this;
    },
    
    unwatch: function (callback) {
        process.nextTick(callback);
        return this;
    },
    
    multi: function () {
        return new MockedMulti(this);
    }
});

MockedRedis.Multi = MockedMulti;

module.exports = MockedRedis;
