/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

const http = require('http')
const https = require('https')
const EE3 = require('eventemitter3')
const { PassThrough } = require('stream')

// rename ForwardRequest
module.exports = class Request extends EE3 {
  constructor(options, inc, contents) {
    super()

    this.reqParams = options.request
    this.retryParams = Object.assign({
      maxRetries: 3,
      delay: 300,
      retryOnInternalError: false
    }, options.retry)

    this.timer = null
    this.inc = inc
    this.retries = 0
    this.request = null
    this.shouldRetry = null
    this.contents = contents
    this.buffer = null
  }

  execute() {
    this.request = (this.reqParams.protocol === 'https:' ? https : http).request(this.reqParams)

    this.request.on('error', (err) => {
      this.shouldRetry = this.shouldDoRetry(err)
      this.emit('error', err, this.request, this.shouldRetry)
      this.done()
    })

    this.request.on('response', (inc) => {
      this.shouldRetry = this.shouldDoRetry(null, inc.statusCode)
      this.emit('response', this.request, inc, this.shouldRetry)
      this.done()
    })

    // Build a buffer as a stream for the contents
    // use "global" variable to handle memory during recursion
    this.buffer = new PassThrough({ highWaterMark: this.contents.length })
    this.buffer.write(this.contents)
    this.buffer.end()
    this.buffer.pipe(this.request)
  }

  done() {
    if (!this.shouldRetry) {
      this.cleanup()
      return
    }

    // Retry
    this.retries += 1
    // Exponential backoff delay
    /* eslint-disable no-mixed-operators */
    const delay = Math.floor(Math.random() * (Math.pow(this.retries, 2) - 1) + 1) * this.retryParams.delay
    /* eslint-enable no-mixed-operators */
    this.timer = setTimeout(() => { this.execute() }, delay)
  }

  shouldDoRetry(err, status) {
    if (!err && !this.retryParams.retryOnInternalError) {
      return false
    }

    if (this.retries >= this.retryParams.maxRetries) {
      return false
    }

    return err !== null || (status >= 500 && this.retryParams.retryOnInternalError)
  }

  cleanup() {
    this.buffer = null
    this.request = null
  }
}
