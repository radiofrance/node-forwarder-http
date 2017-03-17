/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * Example: Using events
 */

const http = require('http')
const Forwarder = require('../lib/Forwarder')

const server = new Forwarder({
  // The servers to forward the request to. One of them doesn't exist.
  forwardTargets: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002', 'http://127.0.0.1:9003'],
})
server.listen(9000)

// Don't forward a specific URL and add a header to all forwarded requests
server.on('request', (inc, res) => {
  // Healthcheck route for service discovery tools
  if (inc.url === '/healthcheck') {
    res.end()
    return
  }

  inc.headers['x-query-token'] = 'mytoken'
})

server.on('response', (inc, res) => {
  // Send the token back with the forwarder response
  res.setHeader('x-query-token', inc.headers['x-query-token'])
})

server.on('forwardRequest', info => {
  // Cancel requests to a target
  if (info.host === '127.0.0.1:9002') {
    info.cancel = true
  }

  // Set a header on all forwards for a specific target
  if (info.headers['host'] === '127.0.0.1:9001') {
    info.headers['who-are-you'] = 'I am Groot'
  }
})

// Capture responses from each of the targets
server.on('forwardResponse', (req, inc) => {
  console.log(`TARGET ${req.getHeader('host')} responded: ${inc.statusCode} : ${inc.statusMessage}`)
})

// Capture errors in any of the targets
server.on('forwardRequestError', (err, req) => {
  console.log(`TARGET ${req.getHeader('host')} failed: ${err.code} ${err.message}`)
})

// Start target servers
http.createServer((req, res) => {
  console.log(`TARGET http://127.0.0.1:9001 (${req.headers['who-are-you']}):  Received: ${req.method} ${req.url}. Token="${req.headers['x-query-token']}"`)
  res.end()
}).listen(9001)
http.createServer((req, res) => {
  console.log(`TARGET http://127.0.0.1:9002  Received: ${req.method} ${req.url}. Token="${req.headers['x-query-token']}"`)
  res.end()
}).listen(9002)

// Send a request
console.log("SCRIPT: Sending a request to the forwarder: POST /somepath")
http.request({
  hostname: '127.0.0.1',
  port: 9000,
  path: '/somepath',
  method: 'POST'
}, res => {
  console.log(
    `SCRIPT: Forwarder replied ${res.statusCode} ${res.statusMessage}. Token="${res.headers['x-query-token']}"`
  )
}).end()

