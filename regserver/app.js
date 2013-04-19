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

require("mootools");

var express = require("express");
var app = express();

app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
});

require("./lib/dbfactory").build(function (err, db) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    
    require("./routes/api").register(app, db);
    
    var port = process.env.PORT || 80;
    app.listen(port, function() {
        console.log("Registration server is listening on port " + port);
    });
}); 
