# Forwarder HTTP

[![Build
Status](https://travis-ci.org/radiofrance/node-forwarder-http.svg?branch=master)](https://travis-ci.org/radiofrance/node-forwarder-http)

```forwarder-http``` is a simple HTTP/HTTPS forwarder. On each request it :

- Replies to the sender immediately with a ```200``` (unless you configure it
otherwise)
- Forwards the request to all configured target servers

It is meant to be simple, pluggable via Events, and totally configurable.

It currently supports only ```node >=6.x.x```.

## Our use case at @RadioFrance

We built this library because we needed a tiny-footprint tool to dispatch
incomming production data to different development environments.

## How-to

An example is worth a thousand words:

```javascript
const Forwarder = require('forwarder-http')

const server = new Forwarder({
  // The servers to forward the request to
  forwardTargets: ['http://target-nb-1.com', 'http://target-nb-2.com'],

  // Add a header to the request before forwarding
  forwardHeaders: {'token': 'some-complicated-hash'},

  // Define the forwarder response statusCode (default: 200)
  responseStatusCode: 204
})
```

You'll more detailed examples in the [Examples
directory](https://github.com/radiofrance/node-forwarder-http/blob/master/examples)

## Options

The `Forwarder` constructor supports a few options, meant to give the user total
control on how each request and response is handler:

- **https**: _bool_. Create a HTTPS Forwarder server (Default ```false```)
- **https**: _object_. Options to pass to the _https.createServer_ constructor.
Required when using https.
- **timeout**: _int_. Timeout on requests to targets. (Default: null)
- **forwardTargets**: _array_. List of target URLs to forward requests to. See
[the examples](https://github.com/radiofrance/node-http-forwarder/blob/master/examples).
- **forwardHeaders**: _object_. Headers to add to the forwarded request
(Default: empty).
- **forwardOpts**: _object_. Options to pass to the http/https request constructor. See [the example](https://github.com/radiofrance/node-forwarder-http/blob/master/examples/using-https) and [all the options](https://nodejs.org/api/https.html#https_https_request_options_callback)
- **responseStatusCode**: _int_. Status code the forward server will use when responding to requests (Default: 200)
- **responseBody**: _string_. Body the forward server will use when responding to requests (Default: 'OK')
- **responseHeaders**: _object_. Headers the forward server will use when responding to requests (Default: empty)

## Events

The ```forwarder-http``` library allows you to hook into most of the lifecycle to the
forwarding process, and change all the requests and responses along the way.

- **request** ```(incommingMessage, response)```: The resquest event from the
http/https forward server. If you call ```response.end()``` in a callback, the
request will not be forwarded.
- **response** ```(incommingMessage, response)```: Called just before the
forwarder responds to the client.
- **requestError** ```(error, incommingMessage)```: error when handling the
request in the forwarder
- **forwardRequest** ```(options, incommingMessage)```: allows you to change the forwarded
request before it is sent. The first argument is the options array passed on to the
[http.request](https://nodejs.org/api/http.html#http_http_request_options_callback) and [https.request](https://nodejs.org/api/https.html#https_https_request_options_callback)
constructors, after all the config headers and options avec been applied. If you set ```options.cancel = true``` it
will cancel the forwarding of the current request to the current target. Check out the examples for ... well ...
examples on this.
- **forwardResponse** ```(request, incommingMessage)```: allows you to act on
individual target responses.
- **forwardRequestError** ```(error, request)```: error when forwarding
a request to specific targets.

See [the example on how to use the events](https://github.com/radiofrance/node-forwarder-http/blob/master/examples/using-events.js).

## Acknoledgments

- **[node-http-proxy](https://github.com/nodejitsu/node-http-proxy)**: our library started as a forked and simplified version of this library. ```node-http-proxy``` also does proxying, which we do not, also supports versions of node older that 6.0.0, which we do not. But only handles a single forward target server, which didn't solve our problem. We ended up re-writing the whole thing. Anyway, many thanks to the folks at [nodejitsu](https://nodejitsu.com/) for this great pice of code.

