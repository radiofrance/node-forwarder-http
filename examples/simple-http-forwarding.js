/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * Example : Simple forwarding
 */

/* eslint-disable no-console */
const http = require('http')
const fs = require('fs')
const Forwarder = require('../lib/Forwarder')

const server = new Forwarder({
  // The servers to forward the request to
  targets: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002'],
  // Add a header to the request before forwarding
  targetHeaders: { 'some-header': 'some-val' },
  // Define the forwarder response statusCode (default: 200)
  responseStatusCode: 204,
  // Define headers in the forwarder response
  responseHeaders: { 'another-header': 'another-val' }
})

server.listen(9000)

const target = name => (req, res) => {
  // Buffer the received payload
  const data = []
  req.on('data', chunk => data.push(chunk))

  req.on('end', () => {
    console.log(`[${name}]  Received: ${req.method} ${req.url}. Header "some-header"=${req.headers['some-header']}`)
    console.log(`[${name}]  Payload totals: ${data.length} chunks, ${Buffer.byteLength(Buffer.concat(data))} bytes`)
    res.end()
  })
}

// Start target servers
http.createServer(target('TARGET_1')).listen(9001)
http.createServer(target('TARGET_2')).listen(9002)

// Send a request
console.log('[SCRIPT]    Sending a request to the forwarder: POST /somepath')
const req = http.request({
  hostname: '127.0.0.1',
  port: 9000,
  path: '/somepath',
  method: 'POST'
}, res => console.log(`[SCRIPT]    forwarder replied with statusCode=${res.statusCode}`, 'headers', res.headers))

const data = fs.createReadStream('./testfile.3mb.test', { flags: 'r', highWaterMark: 16 * 1024 })
data.pipe(req, { end: true })

