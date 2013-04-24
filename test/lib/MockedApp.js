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

var MockedApp = new Class({
    initialize: function () {
        this.routes = {};
    },
    
    post: function (path, handler) {
        this.routes[path] = handler; 
    },
    
    invoke: function (path, req, res) {
        this.routes[path](req, res);
        return res;
    },
    
    request: function (path, payload, callback) {
        return new MockedApp.Response()
                .on("end", callback)
                .invoke(this, path, new MockedApp.Request(payload));
    }
});

MockedApp.Request = new Class({
    initialize: function (body) {
        this.body = body;
    }
});

MockedApp.Response = new Class({
    Implements: [process.EventEmitter],
    
    initialize: function () {
        this.statusCode = 200;
    },
    
    json: function (statusCode, object) {
        if (object) {
            this.statusCode = statusCode;
            this.data = object;
        } else {
            this.data = statusCode;
        }
        this.emit("end", this.statusCode, this.data);
        return this;
    },
    
    invoke: function (app, path, req) {
        return app.invoke(path, req, this);
    }
});

module.exports = MockedApp;
