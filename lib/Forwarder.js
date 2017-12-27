/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const urlParse = require('url').parse
const http = require('http')
const https = require('https')
const path = require('path')
const EE3 = require('eventemitter3')
const ForwardRequest = require('./ForwardRequest')

module.exports = class Forwarder extends EE3 {
  constructor(options) {
    super()

    this.server = null
    this.options = Object.assign({
      https: false,
      httpsOpts: {},
      timeout: null,
      targets: [],
      targetOpts: {},
      targetHeaders: {},
      targetRetry: { maxRetries: 0 }, // don't retry by default
      responseStatusCode: 200,
      responseBody: 'OK',
      responseHeaders: { 'Content-Type': 'text/plain' }
    }, options)

    // Check options
    if (!this.options.targets.length) {
      throw new Error('options.targets cannot be empty')
    }

    this.targets = this.options.targets.map(target => this.parseTarget(target))

    this.on('error', (err) => {
      if (this.listeners('error').length === 1) {
        throw err
      }
    })
  }

  parseTarget(t) {
    const target = (typeof t === 'string') ? { url: t } : t

    target.parsedUrl = urlParse(target.url)
    if (!target.parsedUrl.protocol || !target.parsedUrl.hostname) {
      throw new Error(`Invalid target url: "${target.url}"`)
    }

    target.opts = Object.assign({}, this.options.targetOpts, 'opts' in target ? target.opts : {})
    target.headers = Object.assign({}, this.options.targetHeaders, 'headers' in target ? target.headers : {})
    target.retry = Object.assign({}, this.options.targetRetry, 'retry' in target ? target.retry : {})

    return target
  }

  listen(...args) {
    const listener = (inc, res) => {
      if (this.options.requestTimeout) {
        inc.setTimeout(this.options.requesTimeout)
      }

      // Notify reception of request
      this.emit('request', inc, res)

      // Don't proxy if the request handler ended the response
      if (res.finished) return

      // Buffer the request data
      const data = []
      inc.on('data', chunk => data.push(chunk))

      // Request is over, forward it to the targets
      inc.on('end', () => {
        const contents = Buffer.concat(data)
        this.emit('requestContents', inc, contents)
        this.forwardRequests(inc, contents)

        this.respond(inc, res)
      })

      inc.on('error', err => this.emit('requestError', err, inc))
    }

    if (this.options.https) {
      this.server = https.createServer(this.options.httpsOpts, listener)
    } else {
      this.server = http.createServer(listener)
    }

    if (this.options.timeout) {
      this.server.setTimeout(this.options.timeout)
    }

    this.server.on('error', err => this.emit('serverError', err))
    this.server.listen(...args)
    return this
  }

  forwardRequests(inc, contents) {
    this.targets
      // Build the data for each forward request
      .map((target) => {
        const params = Forwarder.buildRequestParams(target, inc)
        params.cancel = false
        this.emit('forwardRequest', params, inc)
        return params
      })
      // filter out the ones that were canceled
      .filter(params => !params.cancel)
      // Initiate the requests
      .map(params => new ForwardRequest(params, inc, contents))
      // Pipe all forward requests and bind events
      .forEach((forwardRequest) => {
        // Notify Error
        forwardRequest.on(
          'error',
          (err, req, willRetry) => this.emit('forwardRequestError', err, req, willRetry)
        )

        // Notify Response
        forwardRequest.on(
          'response',
          (req, forwardInc, willRetry) => this.emit('forwardResponse', req, forwardInc, willRetry)
        )

        forwardRequest.execute()
      })
  }

  static buildRequestParams(target, inc) {
    const params = { request: {}, retry: {} }
    const incUrl = urlParse(inc.url);

    // Build request params
    ['protocol', 'host', 'hostname', 'port', 'auth'].forEach((h) => {
      params.request[h] = target.parsedUrl[h]
    })
    params.request.method = inc.method
    params.request.path = path.join(target.parsedUrl.path, incUrl.path)

    Object.keys(target.opts).forEach((opt) => {
      params.request[opt] = target.opts[opt]
    })

    // Build request headers
    params.request.headers = Object.assign(
      {},
      inc.headers, // By default, take the incomming requests headers
      { host: target.parsedUrl.host }, // Overwrite the Host (often used in proxys to process the request)
      target.headers // apply target specific overwites
    )

    params.retry = target.retry
    return params
  }

  respond(inc, res) {
    Object.keys(this.options.responseHeaders).forEach(h => res.setHeader(h, this.options.responseHeaders[h]))

    this.emit('response', inc, res)

    // Users can respond directly
    if (res.finished) return

    if (!res.headersSent) {
      res.writeHead(this.options.responseStatusCode)
    }

    res.write(this.options.responseBody)
    res.end()
  }

  close(cb) {
    if (!this.server) return

    this.server.close((...args) => {
      this.server = null
      if (cb) cb(...args)
    })
  }
}

