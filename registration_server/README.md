# Push Network Registration Server
Applications on mobile devices register their information on Registration Server, and fetch a registration id, this registration id will be later used to be an unique identity card in push service.

# License
Apache License 2.0

# Running the registration server
Install nodejs with version "0.8.x"
Install mongodb "2.2"
Start a mongodb instance

npm install

export REGISTRATION_SERVER_MONGODB_URL=mongodb://localhost/sample1
export REGISTRATION_SERVER_PORT=9999   ### optional

node app
