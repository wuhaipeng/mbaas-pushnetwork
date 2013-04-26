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

var JsonProtocol = new Class({
    name: "msg-json",
    
    decode: function (message) {
        if (message && message.type == "utf8") {
            try {
                return JSON.parse(message.utf8Data);
            } catch (e) {
                
            }
        }
        return null;
    },
    
    encode: function (event, params) {
        params.event = event;
        return JSON.stringify(params);
    }
});

function jsonFactory() {
    return new JsonProtocol();
}

var preferredProtocols = [
    { name: "msg-json", factory: jsonFactory }
];

exports.select = function (protocols) {
    var factory;
    preferredProtocols.some(function (proto) {
        if (protocols.indexOf(proto.name) >= 0) {
            factory = proto.factory;
            return true;
        }
        return false;
    });
    return factory ? factory() : null;
};
