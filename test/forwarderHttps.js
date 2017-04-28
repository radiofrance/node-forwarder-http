/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const Forwarder = require('../lib/Forwarder')
const assert = require('chai').assert
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Port generator to avoid conflicts when tests are run in parallel
let currentPort = 1024
const getPort = () => currentPort++

describe('Forwarder HTTPS', () => {
  it('Should pipe HTTPS to HTTP', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      https: true,
      httpsOpts: {
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
      },
      targets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer(req => {
      assert.equal(req.method, 'GET'),
      assert.equal(req.url, '/somepath')
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    https.request({
      host: '127.0.0.1',
      port: serverPort,
      path: '/somepath',
      method: 'GET',
      rejectUnauthorized: false
    }, () => {}).end()
  })

  it('Should pipe HTTPS to HTTPS', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      https: true,
      httpsOpts: {
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
      },
      targets: [`https://127.0.0.1:${t1port}`],
      targetOpts: {
        rejectUnauthorized: false
      }
    })

    const target = https.createServer({
      key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
    }, req => {
      assert.equal(req.method, 'GET'),
      assert.equal(req.url, '/somepath')
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    https.request({
      host: '127.0.0.1',
      port: serverPort,
      path: '/somepath',
      method: 'GET',
      rejectUnauthorized: false
    }, () => {}).end()
  })

  it('Should pipe HTTP to HTTPS', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`https://127.0.0.1:${t1port}`],
      targetOpts: {
        rejectUnauthorized: false
      }
    })

    const target = https.createServer({
      key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
    }, req => {
      assert(req.method, 'GET')
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    http.request({
      host: '127.0.0.1',
      port: serverPort,
      path: '/somepath',
      method: 'GET'
    }, () => {
    }).end()

  })

  it('Should allow us to mix HTTP and HTTPS targets', done => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      targets: [
        `http://127.0.0.1:${t1port}`,
        {
          url: `https://127.0.0.1:${t2port}`,
          opts: {rejectUnauthorized: false}
        }
      ]
    })

    const doneTargets = new Set()

    const handler = (tgs, p) => req => {
      assert.strictEqual(req.method, 'POST')
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'some-value')
      doneTargets.add(p)

      if (doneTargets.size == 2) {
        doneTargets.forEach(port => tgs[port].close())
        server.close()
        done()
      }
    }

    const targets = []
    targets[t1port] = http.createServer(handler(targets, t1port)).listen(t1port)
    targets[t2port] = https.createServer({
      key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
    }, handler(targets, t2port)).listen(t2port)

    server.listen(serverPort)
    http.request({
      hostname: '127.0.0.1',
      port: serverPort,
      method: 'POST',
      headers: {
        'my-header': 'some-value'
      }
    }, () => {}).end()
  })


  it('By default, should not allow self-signed certs in target hosts', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`https://127.0.0.1:${t1port}`]
    })

    const target = https.createServer({
      key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
    }, () => {
      target.close()
      server.close()
      assert.fail()
    }).listen(t1port)

    server.on('forwardRequestError', err => {
      assert.instanceOf(err, Error)
      target.close()
      server.close()
      done()
    })

    server.listen(serverPort)
    http.request({
      host: '127.0.0.1',
      port: serverPort,
      path: '/somepath',
      method: 'GET'
    }, () => {}).end()

  })
})

