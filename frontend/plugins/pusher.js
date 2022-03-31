// A class that handles the signaling works to get connected with remote peers.
export default class Pusher {
  constructor({onClose = null, maxRetryCount = 10, retryFrequency = 10000} = {}) {
    this._maxRetryCount   = maxRetryCount
    this._retryFrequency  = retryFrequency

    this._subscriptions   = {}
    this._open            = false
    this._retryCount      = 0

    if(onClose) this._onClose = onClose
  }

  init(socket) {
      this._socket = socket
    
      this._socket.addEventListener('error', error => {
        this._onCloseHandler(error)
      })
      this._socket.addEventListener('close', error => {
        this._onCloseHandler(error)
      })

      for(let event in this._subscriptions) {
        this.subscribe(event, this._subscriptions[event])
      }
  
      // Handling message from signal server
      this._socket.addEventListener('message', event => {
        let data = JSON.parse(event.data)
        if(data.msgType != 'pusher') return

        if(this._subscriptions[data.event])
          this._subscriptions[data.event](data.data)
      })
  }

  subscribe(event, callback) {
    this._send({
      action: 'subscribe',
      event, 
    })

    this._subscriptions[event] = callback
  }

  unsubscribe(event) {
    this._send({
      action: 'unsubscribe',
      event, 
    })

    delete this._subscriptions[event]
  }

  isOpen() {
    return this._open
  }

  destroy() {
    this._socket.close()
  }

  _onCloseHandler(event) {
    this._open = false
    this._onClose(event)

    // if(this._retryCount == 0) {
    //   console.error('[Pusher] - Connection lost. Reason:', event)
    // }

    // if(this._retryCount == this._maxRetryCount) {
    //   this._onClose(event)
    //   return
    // }

    // console.warn(`[Pusher] - Trying to reconnect in ${this._retryFrequency/1000} seconds. Attempt ${this._retryCount+1}/${this._maxRetryCount}.`)
    // setTimeout(() => {
    //   this._retryCount++
    //   this.connect()
    // }, this._retryFrequency)
  }

  _onClose() { console.warn('[Pusher] - Connection with the real-time server closed.') }

  _send(data) {
    this._socket.send(JSON.stringify(data))
  }
}