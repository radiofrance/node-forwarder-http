/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const Forwarder = require('../../lib/Forwarder')
const assert = require('chai').assert
const parseUrl = require('url').parse

describe('Forwarder', () => {
  describe('Constructor', () => {
    it('Should throw if no targets are defined', done => {
      let error
      try {
        new Forwarder({})
      } catch (err) {
        error = err
      }

      assert.instanceOf(error, Error)
      assert.equal(error.message, 'options.targets cannot be empty')
      done()
    })

    it('Should throw if there are invalid URLs as targets in the options', done => {
      const tests = [
        ['this is not an url', 'http://127.0.0.1:12345'],
        [{url: 'this is not an url'}],
        [{url: 'www.google.com'}]
      ]
      let error
      tests.forEach(targets => {
        error = null
        try {
          new Forwarder({targets})
        } catch (err) {
          error = err
        }
        assert.instanceOf(error, Error)
        assert.include(error.message, 'Invalid target url')
      })
      done()
    })

    it('Should accept strings as targets', done => {
      const forwarder = new Forwarder({targets: ['http://127.0.0.1']})
      assert.lengthOf(forwarder.targets, 1)
      assert.deepEqual(forwarder.targets[0].url, 'http://127.0.0.1')
      done()
    })

    it('Should set the default target opts, headers and retry params for each target', done => {
      const config = {
        targets: [{url: 'http://www.google.com'}, {url: 'https://bingo.com'}],
        targetOpts: {someOpt: 'someVal'},
        targetHeaders: {someHeaders: 'someHeaderVal'},
        targetRetry: {maxRetries: 3}
      }
      const forwarder = new Forwarder(config)

      assert.lengthOf(forwarder.targets, config.targets.length)
      config.targets.forEach((t, i) => {
        assert.equal(forwarder.targets[i].url, t.url)
        assert.deepEqual(t.opts, config.targetOpts)
        assert.deepEqual(t.headers, config.targetHeaders)
        assert.deepEqual(t.retry, config.targetRetry)
      })
      done()
    })

    it('Should set target specific opts, headers and retry params', done => {
      const config = {
        targets: [
          {
            url: 'http://www.google.com',
            opts: {someTargetOpt: 'someTargetOptVal', someOpt: 'someValTarget'},
            headers: {someTargetHeader: 'someTargetHeaderVal', someHeader: 'someHeaderValInTarget'},
            retry: {delay: 500}
          }
        ],
        targetOpts: {someOpt: 'someVal', defaultOpt: 'defaultVal'},
        targetHeaders: {someHeader: 'someHeaderVal'},
        targetRetry: {maxRetries: 6}
      }
      const forwarder = new Forwarder(config)

      assert.lengthOf(forwarder.targets, 1)
      const target = forwarder.targets[0]
      assert.equal(target.url, config.targets[0].url)
      assert.deepEqual(target.opts, {
        someOpt: 'someValTarget',          // Overwritten by target
        someTargetOpt: 'someTargetOptVal', // Target only
        defaultOpt: 'defaultVal'           // config only
      })
      assert.deepEqual(target.headers, {
        someHeader: 'someHeaderValInTarget',
        someTargetHeader: 'someTargetHeaderVal'
      })
      assert.deepEqual(target.retry, {
        delay: 500,
        maxRetries: 6
      })
      done()
    })
  })

  describe('Request params builder', () => {
    it('Adds target options, headers and retry to the request info', done => {
      const inc = {method: 'GET', url: 'http://somehost.com/hello',  headers: {incHeader: 'incVal'}}

      const params = Forwarder.buildRequestParams({
        url: 'http://www.bingo.com',
        parsedUrl: parseUrl('http://www.bingo.com'),
        opts: {someOpt: 'someVal'},
        headers: {myHeader: 'myVal'},
        retry: {maxRetries: 5}
      }, inc)

      assert.property(params, 'request')
      assert.property(params, 'retry')
      assert.deepEqual(params.retry, {maxRetries: 5});
      [['someOpt', 'someVal'], ['method', 'GET']].forEach(o => {
        assert.property(params.request, o[0])
        assert.equal(params.request[o[0]], o[1])
      });
      [['incHeader', 'incVal'], ['myHeader', 'myVal']].forEach(h => {
        assert.property(params.request.headers, h[0])
        assert.equal(params.request.headers[h[0]], h[1])
      })
      done()
    })

    it('Overwrites the host header from the original request', done => {
      const inc = {method: 'GET', url: 'http://somehost.com/hello',  headers: {incHeader: 'incVal'}}
      const params = Forwarder.buildRequestParams({
        url: 'http://www.bingo.com',
        parsedUrl: parseUrl('http://www.bingo.com'),
        opts: {},
        headers: {},
        retry: {}
      }, inc)

      assert.property(params.request.headers, 'host')
      assert.equal(params.request.headers.host, 'www.bingo.com')
      done()
    })

    it('Appends the incoming path to the target URL', done => {
      const inc = {method: 'GET', url:'http://somehost.com/reqpath/bonus'}
      const params = Forwarder.buildRequestParams({
        url: 'http://www.bingo.com/basepath',
        parsedUrl: parseUrl('http://www.bingo.com/basepath'),
        opts: {},
        headers: {},
        retry: {}
      }, inc)

      assert.equal(params.request.path, '/basepath/reqpath/bonus')
      done()
    })
  })
})

