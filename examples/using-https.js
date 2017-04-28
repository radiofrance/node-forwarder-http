/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

/*
 * HTTPS-to-HTTPS Example
 */

const https = require('https')
const Forwarder = require('../lib/Forwarder')
const fs = require('fs')
const path = require('path')

const key = fs.readFileSync(path.join(__dirname, '..', 'test', 'ssl', 'key.pem'))
const cert = fs.readFileSync(path.join(__dirname, '..', 'test', 'ssl', 'cert.pem'))

const server = new Forwarder({
  https: true,
  // Options passed to the https.createServer
  // cf. https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
  httpsOpts: {key, cert},
  // The servers to forward the request to (also using HTTPS in this example)
  targets: ['https://127.0.0.1:9001', 'https://127.0.0.1:9002'],
  // Options passed to the https.request call
  // cf. https://nodejs.org/api/https.html#https_https_request_options_callback
  targetOpts: {
    rejectUnauthorized: false
  }
})

server.listen(9000)

// Start HTTPS target servers
https.createServer({key, cert}, (req, res) => {
  console.log(`TARGET https://127.0.0.1:9001 Received: ${req.method} ${req.url}.`)
  res.end()
}).listen(9001)
https.createServer({key, cert}, (req, res) => {
  console.log(`TARGET https://127.0.0.1:9902 Received: ${req.method} ${req.url}.`)
  res.end()
}).listen(9002)

// Send a request
console.log("SCRIPT: Sending a request to the forwarder: POST /somepath")
https.request({
  hostname: '127.0.0.1',
  port: 9000,
  path: '/somepath',
  method: 'POST',
  rejectUnauthorized: false
}, res => {
  console.log(
    `SCRIPT: forwarder Replied ${res.statusCode}:${res.statusMessage}`
  )
}).end()

