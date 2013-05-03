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

getService = function(sName) {
  var services = JSON.parse(process.env.VCAP_SERVICES)
  var service = null
  for(var key in services) {
    if(key.split('-')[0].toLowerCase() === sName) {
      return services[key][0].credentials
    }
  }
}

var debug = require("debug"),
    RedisHelper   = require("./RedisHelper"),
    MessageStore  = require("./MessageStore"),
    MessageQueue  = require("./MessageQueue");
    Registrations = require("./Registrations");

var theMessageStore, theMessageQueue, theRegistrations;

var Settings = {
    // constants
    
    // Push Worker heartbeats
    HEARTBEAT_EXPIRE: 60,   // maximum period a heartbeat must be sent, in seconds
    HEARTBEAT_PERIOD: 30,   // commonly used period to send a heartbeat
    
    // WebSocket idle time
    SOCKET_MAXIDLE: 60000,  // maximum idle time before first event for a WebSocket
    
    // Storage
    MAX_TTL: 43200,         // maximum message expiration, 30 days
    MAX_QUEUEDMSGS: 10,     // maximum number of messages in queue
    
    // Requests
    MAX_REGIDS_INREQ: 1000, // maximum regisration Ids in one request

    // Environment
    LISTENING_PORT: 3000,   // default listening port
    REDIS_CONN: "redis://localhost",
    DB_CONN: "cached:redis://localhost/1,mongodb://localhost/pushnetwork",
    
    // Initialization
    initialize: function (callback) {
        if (process.env.PORT) {
            this.LISTENING_PORT = process.env.PORT;
        } else if (process.env.VCAP_APP_PORT) {
            this.LISTENING_PORT = process.env.VCAP_APP_PORT;
        }

        var redis = getService("redis")
        if (process.env.REDIS_CONN) { 
            this.REDIS_CONN = process.env.REDIS_CONN;
        } else if (redis) {
            this.REDIS_CONN = "redis://:" + redis.password + "@" + redis.host + ":" + redis.port
        }

        var mongodb = getService("mongodb");
        if (process.env.DB_CONN) {
            this.DB_CONN = process.env.DB_CONN;
        } else if (mongodb) {
            this.DB_CONN = mongodb.url
        }
        
        var trace = this.tracer("pn:comm:sets");
        trace("DB_CONN=" + this.DB_CONN);
        trace("REDIS_CONN=" + this.REDIS_CONN);
        trace("LISTENING_PORT=" + this.LISTENING_PORT);
        
        var err;
        try {
            this.dataAccessor = require("./DataAccessorFactory").createDataAccessor(this.DB_CONN);
        } catch (e) {
            e = err;
        }
        callback(err);
    },
    
    // Helpers
    connectRedis: function () {  // connect In-Memory Redis
        return RedisHelper.connect(this.REDIS_CONN, { memory: true });
    },
    
    tracer: function (name) {
        var fn = debug(name);
        return fn.enabled ? function () {
            var args = [].slice.call(arguments);
            if (args.length > 0 && typeof(args[0]) == "string") {
                args[0] = "@" + Date.now() + " " + args[0];
            }
            return fn.apply(this, args);
        } : fn;
    },
    
    get messageStore () {   // connect to persistent message storage
        if (!theMessageStore) {
            theMessageStore = new MessageStore(this.dataAccessor);
        }
        return theMessageStore;
    },
    
    get messageQueue () {
        if (!theMessageQueue) {
            theMessageQueue = new MessageQueue(this.dataAccessor);
        }
        return theMessageQueue;
    },
    
    get registrations () {
        if (!theRegistrations) {
            theRegistrations = new Registrations(this.dataAccessor);
        }
        return theRegistrations;
    }
};

module.exports = Settings;
