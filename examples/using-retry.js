/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * Example: Using Retry
 */

const http = require('http')
const Forwarder = require('../lib/Forwarder')

const server = new Forwarder({
  // The servers to forward the request to. One of them doesn't exist.
  targets: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002'],
  targetRetry: {
    maxRetries: 3,
    delay: 500,
    retryOnInternalError: true
  }
})
server.listen(9000)

// Capture responses from each of the targets
server.on('forwardResponse', (req, inc, willRetry) => {
  const retryMsg = inc.statusCode >= 500 && willRetry ? 'Will retry in a few milliseconds' : 'Will not retry'
  console.log(`TARGET ${req.getHeader('host')} responded: ${inc.statusCode} : ${inc.statusMessage}. ${retryMsg}`)
})

// Capture errors in any of the targets
server.on('forwardRequestError', (err, req, willRetry) => {
  const retryMsg = willRetry ? 'Will retry in a few milliseconds' : 'Will not retry'
  console.log(`TARGET ${req.getHeader('host')} failed: ${err.code} ${err.message}. ${retryMsg}`)
})

// Start target server
http.createServer((req, res) => {
  res.writeHead(500)
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
  console.log(`SCRIPT: Forwarder replied ${res.statusCode} ${res.statusMessage}.`)
}).end()

