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

var RedisHelper = require("./RedisHelper");

var theMessageStore, theMessageQueue;

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
    
    // Initialization
    initialize: function (callback) {
        callback();
    },
    
    // Helpers
    connectRedis: function (options) {  // connect In-Memory Redis
        return RedisHelper.connect(process.env.REDIS_CONN, options);
    },
    
    get messageStore () {   // connect to persistent message storage
        if (!theMessageStore) {
            var MongoDbMessageStore = require("./MongoDbMessageStore");
            theMessageStore = new MongoDbMessageStore(process.env.MONGODB_CONN);
        }
        return theMessageStore;
    },
    
    get messageQueue () {
        if (!theMessageQueue) {
            var MongoDbMessageQueue = require("./MongoDbMessageQueue");
            theMessageQueue = new MongoDbMessageQueue(process.env.MONGODB_CONN);
        }
        return theMessageQueue;
    }
};

module.exports = Settings;
