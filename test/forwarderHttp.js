/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const Forwarder = require('../lib/Forwarder')
const { assert } = require('chai')
const http = require('http')

// Port generator to avoid conflicts when tests are run in parallel
let currentPort = 1024 // eslint-disable-line no-unused-vars
const getPort = () => currentPort++ // eslint-disable-line

describe('Forwarder HTTP', () => {
  it('Pipes the request to multiple targets', (done) => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`, `http://127.0.0.1:${t2port}`]
    })

    const targets = {}
    const doneTargets = new Set();
    [t1port, t2port].forEach((p) => {
      targets[p] = http.createServer((req, res) => {
        assert.strictEqual(req.method, 'POST')
        assert.property(req.headers, 'my-header')
        assert.strictEqual(req.headers['my-header'], 'some-value')
        res.end()
        doneTargets.add(p)

        if (doneTargets.size === 2) {
          doneTargets.forEach(port => targets[port].close())
          server.close(() => done())
        }
      }).listen(p)
    })

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

  it('Should not do anything if not targets are defined', (done) => {
    const serverPort = getPort()

    const server = new Forwarder()

    server.on('forwardRequest', () => {
      server.close()
      done(Error('No forward request should be emitted'))
    })

    server.listen(serverPort)

    const testCb = response => () => {
      server.close()
      try {
        assert.equal(response.statusCode, 200)
      } catch (err) {
        done(err)
        return
      }

      done()
    }

    http.request(`http://127.0.0.1:${serverPort}`, res => setTimeout(testCb(res), 10)).end()
  })

  it('Allows us to cancel a forward via the preForwardRequest event', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    server.on('forwardRequest', (params) => {
      if (params.request.host === `127.0.0.1:${t1port}`) {
        params.cancel = true // eslint-disable-line no-param-reassign
      }
    })

    let called = false
    const target = http.createServer(() => {
      called = true
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, () => {
      setTimeout(() => {
        assert.notOk(called)
        target.close()
        server.close()
        done()
      }, 10)
    }).end()
  })

  it('Returns 200 by default if target responds with 20x', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(204)
      res.end()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, (res) => {
      assert.strictEqual(res.statusCode, 200)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Returns 200 by default if target responds with an error', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(500)
      res.end()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, (res) => {
      assert.strictEqual(res.statusCode, 200)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Returns 200 by default if target doesnt respond at all', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    server.listen(serverPort)

    http.request(`http://127.0.0.1:${serverPort}`, (res) => {
      assert.strictEqual(res.statusCode, 200)
      server.close()
      done()
    }).end()
  })

  it('Allows us to hook into the main request/response event', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(200)
      res.end()
    }).listen(t1port)

    const hooks = new Set()
    server.listen(serverPort);
    ['request', 'response'].forEach((h) => {
      server.on(h, () => hooks.add(h))
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {
      assert.equal(hooks.size, 2)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Allows us to hook into the forward request/response event', (done) => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      targets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(200)
      res.end()
    }).listen(t1port)

    let forwardRequestHook = false
    server.listen(serverPort)
    server.on('forwardRequest', () => { forwardRequestHook = true })
    server.on('forwardResponse', () => {
      assert.isOk(forwardRequestHook)
      target.close()
      server.close()
      done()
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Allows us to hook into any forward errors', (done) => {
    const serverPort = getPort()

    const server = new Forwarder({
      targets: ['http://127.0.0.1:1'],
      targetRetry: { maxRetries: 0 }
    })

    server.listen(serverPort)
    server.on('forwardRequestError', () => {
      server.close()
      done()
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Allows us to add target specific headers to the request', (done) => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      targets: [
        { url: `http://127.0.0.1:${t1port}`, headers: { somehead: 'i-am-t1' } },
        `http://127.0.0.1:${t2port}`
      ],
      targetHeaders: { 'my-header': 'my-value' } // This header should be set for all forwards
    })

    let target1
    let target2
    const doneTargets = new Set()
    const closeAll = () => {
      target1.close()
      target2.close()
      server.close()
      done()
    }

    target1 = http.createServer((req, res) => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.strictEqual(req.headers.somehead, 'i-am-t1')
      doneTargets.add(t1port)
      res.end()
      if (doneTargets.size === 2) {
        closeAll()
      }
    })
    target1.listen(t1port)

    target2 = http.createServer((req, res) => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.notProperty(req.headers, 'somehead')
      doneTargets.add(t2port)
      res.end()
      if (doneTargets.size === 2) {
        closeAll()
      }
    })
    target2.listen(t2port)

    server.listen(serverPort)
    http.request({
      hostname: '127.0.0.1',
      port: serverPort,
      method: 'POST'
    }, () => {}).end()
  })

  describe('Retries', () => {
    it('Retries GET requests if target in error', (done) => {
      const serverPort = getPort()

      const server = new Forwarder({
        targets: ['http://127.0.0.1:1234'],
        targetRetry: {
          maxRetries: 2, // we'll have 3 requests
          delay: 1,
          retryOnInternalError: false
        }
      })

      server.listen(serverPort)
      let nbRequests = 1
      server.on('forwardRequestError', (err, req, retry) => {
        assert.instanceOf(err, Error)
        if (nbRequests < 3) {
          assert.ok(retry)
          nbRequests += 1
          return
        }

        assert.equal(3, nbRequests)
        assert.notOk(retry)
        server.close()
        done()
      })

      http.request(`http://127.0.0.1:${serverPort}`, (res) => {
        assert.strictEqual(res.statusCode, 200)
      }).end()
    })

    it('Retries POST requests if target in 500 error', (done) => {
      const serverPort = getPort()
      const t1port = getPort()

      let nbRequests = 1
      const target1 = http.createServer((req, res) => {
        if (nbRequests < 3) { // Sends internal error on first 2 calls, success on the third one.
          nbRequests += 1
          res.writeHead(500)
          res.end()
          return
        }

        let data = ''
        req.on('data', (chunk) => {
          data += chunk
        })
        req.on('end', () => {
          assert.deepEqual(JSON.parse(data), { hello: 'my friend' })
          res.writeHead(200)
          res.end()
        })
      })
      target1.listen(t1port)

      const server = new Forwarder({
        targets: [`http://127.0.0.1:${t1port}`],
        targetRetry: {
          maxRetries: 2, // we'll have 3 requests
          delay: 1,
          retryOnInternalError: true
        }
      })
      server.listen(serverPort)
      server.on('forwardResponse', (req, inc, retry) => {
        if (nbRequests < 3) {
          assert.ok(retry)
          nbRequests += 1
          return
        }

        assert.equal(3, nbRequests)
        assert.notOk(retry)
        target1.close()
        server.close()
        done()
      })

      const req = http.request(
        { host: '127.0.0.1', port: serverPort, method: 'POST' },
        res => assert.strictEqual(res.statusCode, 200)
      )
      req.write(JSON.stringify({ hello: 'my friend' }))
      req.end()
    })
  })
})

