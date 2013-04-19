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

var async  = require("async"),
    uuid   = require("node-uuid"),
    common = require("pn-common");

var Commander = new Class({
    initialize: function () {
        this.name = "pw-" + uuid.v4();
        this.queueName = this.name + ":q";
        this.picksName = this.name + ":p";
        this.redis = common.Settings.connectRedis();
        this.redis.on("ready", function () {
            this.redis.client("SETNAME", this.name);
        }.bind(this));
        this.commands = {};
    },
    
    start: function () {
        this.timer = setInterval(function () {
            this.redis.expire(this.queueName, common.Settings.HEARTBEAT_EXPIRE);
            this.redis.expire(this.picksName, common.Settings.HEARTBEAT_EXPIRE);
        }.bind(this), common.Settings.HEARTBEAT_PERIOD * 1000);
        this.handlePicks();
    },
    
    addCommand: function (name, handler) {
        this.commands[name] = handler;
        return this;
    },
    
    handlePicks: function () {
        this.redis.lrange(this.picksName, 0, -1, function (err, values) {
            if (!err && Array.isArray(values)) {
                async.eachSeries(values, function (item, next) {
                    var command;
                    try {
                        command = JSON.parse(item);
                    } catch (e) {
                        console.error("Invalid JSON: " + item);
                    }
                    if (command) {
                        this.handleCommand(command, next);
                    }
                }, function () {
                    this.redis.del(this.picksName, function () {
                        this.waitQueue();
                    });
                });
            } else {
                this.waitQueue();
            }
        });
    },
    
    waitQueue: function () {
        this.redis.brpoplpush(this.queueName, this.picksName, 0, function () {
            // TODO error handling
            this.handlePicks();
        }.bind(this));
    },
    
    handleCommand: function (command, next) {
        var handler = this.commands[command.action];
        if (typeof(handler) == "function") {
            handler(command, next);
        } else {
            console.log("Unknown command: " + command);
            next();            
        }
    }
});

var theCommander;

exports.get = function () {
    if (!theCommander) {
        theCommander = new Commander();
    }
    return theCommander;
};

exports.start = function () {
    return exports.get().start();
};
