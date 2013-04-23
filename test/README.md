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
