/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * Example: Using events
 */

/* eslint-disable no-console, no-param-reassign */
const http = require('http')
const fs = require('fs')
const Forwarder = require('../lib/Forwarder')

const target = name => (req, res) => {
  // Buffer the received payload
  const data = []
  req.on('data', chunk => data.push(chunk))

  req.on('end', () => {
    console.log(`[${name}] Received: ${req.method} ${req.url}.`, 'Headers', req.headers)
    console.log(`[${name}] Payload totals: ${data.length} chunks, ${Buffer.byteLength(Buffer.concat(data))} bytes`)
    res.end()
  })
}

const server = new Forwarder({
  // The servers to forward the request to. One of them doesn't exist.
  targets: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002', 'http://127.0.0.1:9003']
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

server.on('requestContents', (inc, payload) => {
  console.log(`[SCRIPT]   Request body size is ${payload.byteLength} bytes`)
})

server.on('response', (inc, res) => {
  // Send the token back with the forwarder response
  res.setHeader('x-query-token', inc.headers['x-query-token'])
})

server.on('forwardRequest', (params) => {
  // Cancel requests to a target
  if (params.request.host === '127.0.0.1:9002') {
    params.cancel = true
    console.log('[SCRIPT]   Canceling request to TARGET 2')
  }

  // Set a header on all forwards for a specific target
  if (params.request.headers.host === '127.0.0.1:9001') {
    params.request.headers['who-are-you'] = 'I am Groot'
  }
})

// Capture responses from each of the targets
server.on('forwardResponse', (req, inc) => {
  console.log(`[SCRIPT]   ${req.getHeader('host')} responded: ${inc.statusCode} : ${inc.statusMessage}`)
})

// Capture errors in any of the targets
server.on('forwardRequestError', (err, req) => {
  console.log(`[SCRIPT]   ${req.getHeader('host')} failed: ${err.code} ${err.message}`)
})

// Start target servers
http.createServer(target('TARGET_1')).listen(9001)
http.createServer(target('TARGET_2')).listen(9002)

// Send a request
console.log('[SCRIPT]   Sending a request to the forwarder: POST /somepath')
const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 9000,
    path: '/somepath',
    method: 'POST'
  },
  res => console.log(`[SCRIPT]   Forwarder replied ${res.statusCode} ${res.statusMessage}.`, 'headers', res.headers)
)

const data = fs.createReadStream('./testfile.3mb.test', { flags: 'r', highWaterMark: 16 * 1024 })
data.pipe(req, { end: true })

