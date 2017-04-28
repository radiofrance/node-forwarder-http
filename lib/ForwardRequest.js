/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const http = require('http')
const https = require('https')
const EE3 = require('eventemitter3')
const StreamBuffer = require('./StreamBuffer')

// rename ForwardRequest
module.exports = class Request extends EE3 {
  constructor (options, inc) {
    super()

    this._reqParams = options.request
    this._retryParams = Object.assign({
      maxRetries: 3,
      delay: 300,
      retryOnInternalError: false
    }, options.retry)

    this._timer = null
    this._inc = inc
    this._retries = 0
    this._request = null
    this._shouldRetry
    this._buffer = new StreamBuffer(this._inc)
  }

  execute () {
    this._request = (this._reqParams.protocol === 'https:' ? https : http).request(this._reqParams)

    this._request.on('error', err => {
      this._shouldRetry = this.shouldRetry(err)
      this.emit('error', err, this._request, this._shouldRetry)
      this.done()
    })

    this._request.on('response', inc => {
      this._shouldRetry = this.shouldRetry(null, inc.statusCode)
      this.emit('response', this._request, inc, this._shouldRetry)
      this.done()
    })

    this._buffer.replay(this._request)
  }

  done () {
    if (!this._shouldRetry) {
      this.cleanup()
      return
    }

    // Retry
    this._retries += 1
    // Exponential backoff delay
    const delay = Math.floor(Math.random() * (Math.pow(2, this._retries) - 1) + 1) * this._retryParams.delay
    this._timer = setTimeout(
      function () { // eslint-disable-line prefer-arrow-callback
        this.execute()
      }.bind(this),
      delay
    )
  }

  shouldRetry (err, status) {
    if (!err && !this._retryParams.retryOnInternalError) {
      return false
    }

    if (this._retries >= this._retryParams.maxRetries) {
      return false
    }

    return err !== null || (status >= 500 && this._retryParams.retryOnInternalError)
  }

  abort () {
    if (this._timer) {
      clearTimeout(this._timer)
    }
    if (this._request) {
      this._request.abort()
    }
    this.cleanup()
  }

  cleanup () {
    // Just in case, delete references to the buffered data and request object
    // to prevent memory leaks
    this._buffer.destroy()
    this._request = null
  }
}
