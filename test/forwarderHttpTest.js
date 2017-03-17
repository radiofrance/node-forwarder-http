/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const Forwarder = require('../lib/Forwarder')
const assert = require('chai').assert
const http = require('http')

// Port generator to avoid conflicts when tests are run in parallel
let currentPort = 1024
const getPort = () => currentPort++

describe('Forwarder HTTP', () => {

  it('The constructor should throw if no targets are defined in the options', done => {
    let error
    try {
      new Forwarder({})
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, Error)
    done()
  })

  it('The constructor should throw if there are invalid URLs as targets in the options', done => {
    let error
    try {
      new Forwarder({forwardTargets: ['this is not an url', 'http://127.0.0.1:12345']})
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, Error)
    done()
  })

  it('Should pipe the request to multiple targets', done => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`, `http://127.0.0.1:${t2port}`]
    })

    const targets = {}
    const doneTargets = new Set();
    [t1port, t2port].forEach(p => {
      targets[p] = http.createServer(req => {
        assert.strictEqual(req.method, 'POST')
        assert.property(req.headers, 'my-header')
        assert.strictEqual(req.headers['my-header'], 'some-value')
        doneTargets.add(p)

        if (doneTargets.size == 2) {
          doneTargets.forEach(port => targets[port].close())
          server.close()
          done()
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

  it('Should overwrite the host header with the target host', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer(req => {
      assert.strictEqual(req.headers['host'], `127.0.0.1:${t1port}`)
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Should allow us to cancel a forward via the preForwardRequest event', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    server.on('forwardRequest', info => {
      if (info.host === `127.0.0.1:${t1port}`) {
        info.cancel = true
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

  it('Should return 200 by default if target responds with 20x', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(204)
      res.end()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, res => {
      assert.strictEqual(res.statusCode, 200)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Should return 200 by default if target responds with an error', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(500)
      res.end()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, res => {
      assert.strictEqual(res.statusCode, 200)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Should return 200 by default if target doesnt respond at all', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    server.listen(serverPort)

    http.request(`http://127.0.0.1:${serverPort}`, res => {
      assert.strictEqual(res.statusCode, 200)
      server.close()
      done()
    }).end()
  })

  it('Should allow us to hook into the main request/response event', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(200)
      res.end()
    }).listen(t1port)

    const hooks = new Set()
    server.listen(serverPort);
    ['request', 'response'].forEach(h => {
      server.on(h, () => hooks.add(h))
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {
      assert.equal(hooks.size, 2)
      target.close()
      server.close()
      done()
    }).end()
  })

  it('Should allow us to hook into the forward request/response event', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`]
    })

    const target = http.createServer((req, res) => {
      res.writeHead(200)
      res.end()
    }).listen(t1port)

    let forwardRequestHook = false
    server.listen(serverPort)
    server.on('forwardRequest', () => forwardRequestHook = true)
    server.on('forwardResponse', () => {
      assert.isOk(forwardRequestHook)
      target.close()
      server.close()
      done()
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Should allow us to add headers to the request before forwarding to each server', done => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`, `http://127.0.0.1:${t2port}`],
      forwardHeaders: { 'my-header': 'my-value' }    // This header should be set for all forwards
    })
    server.on('forwardRequest', info => {
      if (info.headers['host'] === `127.0.0.1:${t2port}`) {
        info.headers['my-specific-header'] = 'my-specific-value'
      }
    })

    let target1, target2
    const doneTargets = new Set()
    const closeAll = () => {
      target1.close()
      target2.close()
      server.close()
      done()
    }

    target1 = http.createServer(req => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.notProperty(req.headers, 'my-specific-header')
      doneTargets.add(t1port)
      if (doneTargets.size == 2) {
        closeAll()
      }
    })
    target1.listen(t1port)

    target2 = http.createServer(req => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.property(req.headers, 'my-specific-header')
      assert.strictEqual(req.headers['my-specific-header'], 'my-specific-value')
      doneTargets.add(t2port)
      if (doneTargets.size == 2) {
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

  it('Should allow us to hook into any forward errors', done => {
    const serverPort = getPort()

    const server = new Forwarder({
      forwardTargets: ['http://127.0.0.1:1']
    })

    server.listen(serverPort)
    server.on('forwardRequestError', () => {
      server.close()
      done()
    })

    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Should allow us to add options to the request', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}`],
      forwardOpts: {auth: 'myname:mypass'}
    })

    const target = http.createServer(req => {
      assert.property(req.headers, 'authorization')
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}`, () => {}).end()
  })

  it('Should append the incomming path to the target URL', done => {
    const serverPort = getPort()
    const t1port = getPort()

    const server = new Forwarder({
      forwardTargets: [`http://127.0.0.1:${t1port}/basepath`]
    })

    const target = http.createServer(req => {
      assert.equal(req.url, '/basepath/reqpath/bonus')
      target.close()
      server.close()
      done()
    }).listen(t1port)

    server.listen(serverPort)
    http.request(`http://127.0.0.1:${serverPort}/reqpath/bonus`, () => {}).end()
  })

  it('Should allow us to add target specific headers to the request', done => {
    const serverPort = getPort()
    const t1port = getPort()
    const t2port = getPort()

    const server = new Forwarder({
      forwardTargets: [{
        url: `http://127.0.0.1:${t1port}`,
        headers: {somehead: 'i-am-t1'}
      }, `http://127.0.0.1:${t2port}`],
      forwardHeaders: { 'my-header': 'my-value' }    // This header should be set for all forwards
    })

    let target1, target2
    const doneTargets = new Set()
    const closeAll = () => {
      target1.close()
      target2.close()
      server.close()
      done()
    }

    target1 = http.createServer(req => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.strictEqual(req.headers['somehead'], 'i-am-t1')
      doneTargets.add(t1port)
      if (doneTargets.size == 2) {
        closeAll()
      }
    })
    target1.listen(t1port)

    target2 = http.createServer(req => {
      assert.property(req.headers, 'my-header')
      assert.strictEqual(req.headers['my-header'], 'my-value')
      assert.notProperty(req.headers, 'somehead')
      doneTargets.add(t2port)
      if (doneTargets.size == 2) {
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
})

