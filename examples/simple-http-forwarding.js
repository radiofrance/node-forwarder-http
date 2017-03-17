/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * Example : Simple forwarding
 */

const http = require('http')
const Forwarder = require('../lib/Forwarder')

const server = new Forwarder({
  // The servers to forward the request to
  forwardTargets: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002'],
  // Add a header to the request before forwarding
  forwardHeaders: {'some-header': 'some-val'},
  // Define the forwarder response statusCode (default: 200)
  responseStatusCode: 204,
  // Define headers in the forwarder response
  responseHeaders: {'another-header': 'another-val'}
})

server.listen(9000)

// Start target servers
http.createServer((req, res) => {
  console.log(`TARGET_1:  Received: ${req.method} ${req.url}. Header "some-header"=${req.headers['some-header']}`)
  res.end()
}).listen(9001)
http.createServer((req, res) => {
  console.log(`TARGET_2:  Received: ${req.method} ${req.url}. Header "some-header"=${req.headers['some-header']}`)
  res.end()
}).listen(9002)

// Send a request
console.log("SCRIPT:    Sending a request to the forwarder: POST /somepath")
http.request({
  hostname: '127.0.0.1',
  port: 9000,
  path: '/somepath',
  method: 'POST'
}, res => {
  console.log(
    `SCRIPT:    forwarder replied with statusCode=${res.statusCode} and header "another-header"=${res.headers['another-header']}`
  )
}).end()

