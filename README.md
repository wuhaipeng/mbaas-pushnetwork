[![Build Status](https://travis-ci.org/vmw-tmpst/mbaas-pushnetwork.png?branch=master)](https://travis-ci.org/vmw-tmpst/mbaas-pushnetwork)

#Push Network

Push Network sends push notifications to mobile devices. It performs the similar functionalities as Google Cloud Messaging service.

#How to Run

##Start locally for development

You need `node-foreman` for easily managing all the services with one command:

```bash
npm install foreman -g
```

Then launch in one command:

```bash
nf start -p 10080
```

To launch multiple instances of Push Worker:

```bash
nf start worker=5 -p 10080
```

It will starts 5 Push Worker instances listening from 10280 to 10284.

##Environments for different storage configuration

###MongoDB+RedisCache

This is the default configuration

```bash
DB_CONN=cached:redis://localhost/1,mongodb://localhost/pushnetwork \
nf start -p 10080
```

###MongoDB

```bash
DB_CONN=mongodb://localhost/pushnetwork \
nf start -p 10080
```

###Persistent Redis

```bash
DB_CONN=redis://localhost \
nf start -p 10080
```

#License

Apache License 2.0

