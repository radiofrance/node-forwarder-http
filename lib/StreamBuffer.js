/**
 * (c) 2017 Radio France
 * This program is free software: you can redistribute it and/or modify it under the terms of the CeCILL-B license
 */

module.exports = class StreamBuffer {
  constructor (stream) {
    this.ended = false
    this.buffer = []
    this.stream = stream

    this.stream.on('data', chunk => {
      // The stream buffer might have beed destroyed but the stream itself is still open.
      if (!this.buffer) {
        return
      }

      this.buffer.push(chunk)
    })

    this.stream.on('end', () => {
      this.ended = true
    })
  }

  replay (out) {
    this.buffer.forEach(chunk => out.write(chunk))

    if (this.ended) {
      out.end()
    } else {
      this.stream.pipe(out)
    }
  }

  destroy () {
    this.buffer = null
    this.stream = null
  }
}

