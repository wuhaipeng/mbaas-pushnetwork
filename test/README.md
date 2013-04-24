#Push Network Test Suite

## How To Run

```bash
npm test
```

To enable all functional tests:

```bash
MONGODB_CONN=mongodb://localhost/pushnetwork \
REDIS_CONN=redis://localhost \
npm test
```

## Run Integration Tests

First, all services should be started:

```bash
cd regserver
PORT=10080 npm start
cd ../dispatcher
PORT=10180 npm start
cd ../worker
PORT=10280 npm start
```

To enable integration tests:

```bash
INTEGRATION=1 npm test
```

Here we can also overrides some variables if the services are running remotely or not on the default ports:

```bash
REGSERVER_URL=http://localhost:10080    \
DISPATCHER_URL=http://localhost:10180   \
WORKER_URL=http://localhost:10280       \
INTEGRATION=1 npm test
```
