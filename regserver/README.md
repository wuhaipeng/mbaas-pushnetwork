# Push Network Registration Server
Applications on mobile devices register their information on Registration Server, and fetch a registration id, this registration id will be later used to be an unique identity card in push service.

# License
Apache License 2.0

# Running the registration server
Install nodejs with version "0.8.x"
Install mongodb "2.2"
Start a mongodb instance

export MONGODB_CONN=mongodb://<hostname>/<db>
export PORT=<port>                                   ### optional, default is 80

npm install
node app