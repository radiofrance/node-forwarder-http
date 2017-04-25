module.exports = class StreamBuffer {
  constructor (stream) {
    this.ended = false
    this.buffer = []
    this.stream = stream

    this.stream.on('data', chunk => this.buffer.push(chunk))
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

