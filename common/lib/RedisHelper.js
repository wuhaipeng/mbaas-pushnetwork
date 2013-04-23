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

var redis = require("redis"),
    url = require("url");

exports.connect = function (connUrl, options) {
    var parsedUrl = url.parse(connUrl);
    var port = null, password = null, db = null;
    if (parsedUrl.port) {
        port = parseInt(parseUrl.port);
    }
    if (parsedUrl.auth) {
        password = parsedUrl.auth;
    }
    if (parsedUrl.path && parsedUrl.path.length > 1) {
        db = parseInt(parsedUrl.path.substr(1));
    }
    
    var client = redis.createClient(port, parsedUrl.hostname);
    client.on("error", function (err) {
        if (err) {
            console.error("RedisError: " + err);
        }
    }).on("ready", function () {
        if (options && options.memory) {
            // disable persistency as Redis is only used for caching
            client.config("set", "save", "", function () { });
        }
        if (db) {
            client.select(db);
        }
    });

    if (password) {
        client.auth(password);
    }
    return client;
};
