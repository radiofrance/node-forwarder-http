/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const http = require('http')
const https = require('https')
const EE3 = require('eventemitter3')
const PassThrough = require('stream').PassThrough

// rename ForwardRequest
module.exports = class Request extends EE3 {
  constructor (options, inc, contents) {
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
    this._contents = contents
    this._buffer = null
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

    // Build a buffer as a stream for the contents
    // use "global" variable to handle memory during recursion
    this._buffer = new PassThrough({ highWaterMark: this._contents.length })
    this._buffer.write(this._contents)
    this._buffer.end()
    this._buffer.pipe(this._request)
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

  cleanup () {
    this._buffer = null
    this._request = null
  }
}
