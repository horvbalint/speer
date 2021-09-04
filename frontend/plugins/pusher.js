// A class that handles the signaling works to get connected with remote peers.
export default class Pusher {
  constructor({address = null, onClose = null, maxRetryCount = 10, retryFrequency = 10000}) {
    this._address         = address
    this._maxRetryCount   = maxRetryCount
    this._retryFrequency  = retryFrequency

    this._subscriptions   = {}
    this._open            = false
    this._retryCount      = 0

    if(onClose) this._onClose = onClose
  }

  connect({address = this._address} = {}) {
    return new Promise( (resolve, reject) => {
      this._address           = address
      this._socket            = new WebSocket(this._address)
      this._connectionResolve = resolve
    
      this._socket.addEventListener('error', error => {
        reject(error)
        this._onCloseHandler(error)
      })
      this._socket.addEventListener('close', error => {
        reject()
        this._onCloseHandler(error)
      })
  
      this._socket.addEventListener('open', () => {
        this._retryCount = 0
        
        for(let event in this._subscriptions) {
          this.subscribe(event, this._subscriptions[event])
        }

        console.log('[Pusher] - Connection successful.')
        resolve(this)
      })
  
      // Handling message from signal server
      this._socket.addEventListener('message', event => {
        let data = JSON.parse(event.data)
        
        if(this._subscriptions[data.event])
          this._subscriptions[data.event](data.data)
      })
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
    console.error('[Pusher] - Connection lost. Reason:', event)
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