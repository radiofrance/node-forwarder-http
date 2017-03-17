/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const urlParse = require('url').parse
const http = require('http')
const https = require('https')
const path = require('path')
const EE3 = require('eventemitter3')

module.exports = class Forwarder extends EE3 {

  constructor (options) {
    super()

    this._server = null
    this._options = Object.assign({
      https: false,
      httpsOpts: {},
      timeout: null,
      forwardTargets: [],
      forwardHeaders: {},
      forwardOpts: {},
      responseStatusCode: 200,
      responseBody: 'OK',
      responseHeaders: {'Content-Type': 'text/plain'}
    }, options)

    // Check options
    if (!this._options.forwardTargets.length) {
      throw new Error('options.forwardTargets cannot be empty')
    }

    this._options.forwardTargets = this.parseTargets(this._options.forwardTargets)

    this.on('error', err => {
      if (this.listeners('error').length === 1) {
        throw err
      }
    })
  }

  parseTargets (targets) {
    return targets.map(target => {
      let url, opts, headers

      if (typeof target === 'string') {
        url = target.trim()
        opts = headers = {}
      } else {
        url = 'url' in target ? target.url : ''
        opts = 'opts' in target ? target.opts : {}
        headers = 'headers' in target ? target.headers : {}
      }

      if (!url) {
        throw new Error('Cannot forward anything to an empty target')
      }

      const parsedUrl = urlParse(url)

      if (!parsedUrl.protocol || !parsedUrl.hostname) {
        throw new Error(`invalid target url; ${url}`)
      }

      return {url, opts, headers, parsedUrl}
    })
  }

  listen (...args) {
    const listener = (inc, res) => {
      if (this._options.requestTimeout) {
        inc.setTimeout(this._options.requesTimeout)
      }

      // Notify reception of request
      this.emit('request', inc, res)

      // Don't proxy if the request handler ended the response
      if (res.finished) return

      // Proxy everything
      this.forwardRequests(inc)

      this.respond(inc, res)
    }

    if (this._options.https) {
      this._server = https.createServer(this._options.httpsOpts, listener)
    } else {
      this._server = http.createServer(listener)
    }

    if (this._options.timeout) {
      this._server.setTimeout(this._options.timeout)
    }

    this._server.listen(...args)
    return this
  }

  forwardRequests (inc) {
    const forwardRequests = this._options.forwardTargets
      .map(target => {
        const requestInfo = this.buildForwardRequest(target, inc)
        requestInfo.cancel = false
        this.emit('forwardRequest', requestInfo, inc)
        return requestInfo
      })
      .filter(requestInfo => !requestInfo.cancel)
      .map(requestInfo => {
        delete requestInfo.cancel
        return (requestInfo.protocol === 'https:' ? https : http).request(requestInfo)
      })

    // Error handler for main request: abord all forward request if inbound error.
    inc.on('error', err => {
      if (inc.socket.destroyed && err.code === 'ECONNRESET') {
        forwardRequests.forEach(fReq => fReq.abort())
      }
      this.emit('requestError', err, inc)
    })

    inc.on('aborted', () => forwardRequests.forEach(fReq => fReq.abort()))

    // Pipe all forward requests and bind events
    forwardRequests.forEach(forwardRequest => {
      // Notify Error
      forwardRequest.on(
        'error',
        err => this.emit('forwardRequestError', err, forwardRequest)
      )

      // Notify Response
      forwardRequest.on(
        'response',
        forwardInc => this.emit(
          'forwardResponse',
          forwardRequest,
          forwardInc
        )
      )

      // Send data down the socket
      inc.pipe(forwardRequest)
    })
  }

  buildForwardRequest (target, inc) {
    const info = {}
    const incUrl = urlParse(inc.url);

    ['protocol', 'host', 'hostname', 'port', 'auth'].forEach(h => info[h] = target.parsedUrl[h])
    info.method = inc.method
    info.path = path.join(target.parsedUrl.path, incUrl.path)

    // Add info from the _options
    info.headers = Object.assign(
      {},
      inc.headers,                          // By default, take the incomming requests headers
      {host: target.parsedUrl.host},    // Overwrite the Host (often used in proxys to treat the request)
      this._options.forwardHeaders,         // apply general overwrides
      target.headers                        // apply target specific overwrides
    )

    Object.keys(this._options.forwardOpts).forEach(opt => info[opt] = this._options.forwardOpts[opt])
    Object.keys(target.opts).forEach(opt => info[opt] = target.opts[opt])

    return info
  }

  respond (inc, res) {
    Object.keys(this._options.responseHeaders).forEach(h => res.setHeader(h, this._options.responseHeaders[h]))

    this.emit('response', inc, res)

    // Users can respond directly
    if (res.finished) return

    if (!res.headersSent) {
      res.writeHead(this._options.responseStatusCode)
    }

    res.write(this._options.responseBody)
    res.end()
  }

  close (cb) {
    if (!this._server) return

    this._server.close((...args) => {
      this._server = null
      if (cb) cb(...args)
    })
  }
}

