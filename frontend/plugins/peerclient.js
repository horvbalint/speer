const Peer = require('simple-peer')

// A class that handles the signaling works to get connected with remote peers.
export default class PeerClient {
  constructor({onClose = null, maxRetryCount = 10, retryFrequency = 10000} = {}) {
    this._signaling    = {}
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

    // Handling message from signal server
    this._socket.addEventListener('message', event => {
      let data = JSON.parse(event.data)
      if(data.msgType != 'signal') return

      if(data.error == 'Not friend') {
        if(this._signaling[data.remoteId]) {
          this._signaling[data.remoteId].reject(data.error)
          delete this._signaling[data.remoteId]
        }
        
        return
      }

      if(!this._signaling[data.remoteId]) this._handleNewSignalConnection(data)
      else this._handleReceivedRequestedSignalData(data)
    })
  }

  // Creating connection with a remote peer
  async createConnection(remoteId) {
    return new Connection(await this._signal({remoteId, initiator: true, type: 'basic'}))
  }

  // Creating file connection with a remote peer
  async createFileConnection(remoteId) {
    return new FileConnection(await this._signal({remoteId, initiator: true, type: 'binary'}))
  }

  // Creating call connection with a remote peer
  async createCallConnection(remoteId) {
    return new CallConnection(await this._signal({remoteId, initiator: true, type: 'call'}))
  }

  destroy() {
    this._socket.close()
  }

  // Handling a connection request from a remote peer
  async _handleNewSignalConnection(data) {
    let peer = await this._signal({remoteId: data.remoteId, type: data.type, peerData: data.peerData})

    switch(data.type) {
      case 'binary': this.onFileConnection({connection: new FileConnection(peer), remoteId: data.remoteId}); break;
      case 'call': this.onCallConnection({connection: new CallConnection(peer), remoteId: data.remoteId}); break;
      default: this.onConnection({connection: new Connection(peer), remoteId: data.remoteId})
    }
  }

  // Feeding the remote peer's requested data to Simple-Peer
  async _handleReceivedRequestedSignalData(data) {
    this._signaling[data.remoteId].peer.signal(JSON.parse(data.peerData))
  }


  // Sending connection request to remote peer / feeding new peerData to Simple-Peer
  _signal({remoteId, type, initiator = false, peerData = null}) {
    return new Promise( (resolve, reject) => {
      this._signaling[remoteId] = {resolve, reject} // this needs to exist before the peer is created
      this._signaling[remoteId].peer = this._createPeerForSignaling(remoteId, type, initiator)
      
      if(peerData) this._signaling[remoteId].peer.signal(JSON.parse(peerData))
    })
  }

  _createPeerForSignaling(remoteId, type, initiator) {
    let peer = new Peer({initiator, trickle: true})
    
    peer.on('signal', peerData => {
      this._send({
        action: 'signal',
        remoteId: remoteId,
        peerData: JSON.stringify(peerData),
        type,
      })
    })
    
    peer.on('connect', () => {
      setTimeout(() => {
        this._signaling[remoteId].resolve(peer)
        delete this._signaling[remoteId]
      }, 100)
      
      peer.removeAllListeners('signal')
    })
    
    return peer
  }

  _onCloseHandler(event) {
    this._open = false
    this._onClose(event)

    // if(this._retryCount == 0) {
    //   console.error('[PeerClient] - Connection lost. Reason:', event)
    // }

    // if(this._retryCount == this._maxRetryCount) {
    //   this._onClose(event)
    //   return
    // }

    // console.warn(`[PeerClient] - Trying to reconnect in ${this._retryFrequency/1000} seconds. Attempt ${this._retryCount+1}/${this._maxRetryCount}.`)
    // setTimeout(() => {
    //   this._retryCount++
    //   this.connect()
    // }, this._retryFrequency)
  }

  _onClose() { console.warn('[PeerClient] - Connection with the real-time server closed.') }
  
  // Sending message to signal server
  _send(data) {
    this._socket.send(JSON.stringify(data))
  }

  // TO IMPLEMENT BY DEVELOPER
  onConnection() { console.warn('You have to implement the "onConnection" function yourself!') }
  onFileConnection() { console.warn('You have to implement the "onFileConnection" function yourself!') }
  onCallConnection() { console.warn('You have to implement the "onCallConnection" function yourself!') }
  onClose() { console.warn('You have to implement the "onClose" function yourself!') }
}

// A class that represents a 'normal' connection between two peers and handles communication
class Connection {
  constructor(peer) {
    this.peer = peer

    this.bindedOnData = this._handleData.bind(this)
    this.bindedChannelError = this._handleChannelError.bind(this)

    this.peer.on('data', this.bindedOnData)
    this.peer.on('error', this.bindedChannelError)
    this.peer._onChannelClose = () => this.onClose() // TODO: Use the "close" event
  }

  // Wrapping and sending message to remote peer
  send(message) {
    this.peer.send(JSON.stringify({
      d: message
    }))
  }

  close() {
    this.peer.destroy({error: true})
  }

  // Unwraping and 'emitting' received data from remote peer
  _handleData(data) {
    try {
      data = JSON.parse(data)
      this.onData(data.d)
    }
    catch(err) {}
  }

  _handleChannelError(error) {
    console.error("SimplePeer ERROR", error)

    if(error.code !== 0) return
    this.onClose()
  }

  _destruct() {
    this.peer.off('data', this.bindedOnData)
    this.peer.off('error', this.bindedChannelError)
  }

  // TO IMPLEMENT BY DEVELOPER
  onData() { Logger.log('You have to implement the !<onData>! function yourself!') }
  onClose() { Logger.log('You have to implement the !<onClose>! function yourself!') }
}

// A class that represents a 'binary' connection between two peers and handles file communication between them
class FileConnection {
  constructor(peer) {
    this.isSending = false
    this.isReceiving = false

    this.peer = peer
    this.peer.on('error', this._handleChannelError.bind(this))
    this.peer._onChannelClose = () => this.onClose() // TODO: Use the "close" event

    this.bindedSendConfigCheck = this._sendConfigCheck.bind(this)
    this.bindedRequestConfigCheck = this._requestConfigCheck.bind(this)
    this.bindedSendFileChunks = this._sendFileChunks.bind(this)

    this.percentCallBackFreq = 10

    this._initRecv()
  }
  
  async send(file = null, callback) {
    return new Promise( (resolve, reject) => {
      if(this.isSending) return reject('ERROR: Sending in progress')
      
      this.peer.off('data', this.bindedRequestConfigCheck)
      this._initSend()

      this.isSending = true
      this.sendProperties.resolve = resolve
      this.sendProperties.file = file
      this.sendProperties.percentCallback = callback
      this.sendProperties.chunkCount = Math.ceil(this.sendProperties.file.size/this.sendProperties.chunkSize)
      this.sendProperties.chunkIndex = 0
  
      this.peer.send(JSON.stringify({
        speer: 1,
        type: 'request',
        chunkCount: this.sendProperties.chunkCount,
        data: {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      }))
    })
  }

  close() {
    this.peer.destroy({error: true})
  }

  _handleRequest(data) {
    this.recvProperties.file = data.data
    this.recvProperties.chunkCount = data.chunkCount
    this.recvProperties.chunkIndex = 0

    const request = new FileSendRequest(this.recvProperties.file)
    request._answered()
      .then( ({accepted, callback}) => {
        if(!accepted)
          return this.peer.send(JSON.stringify({
            speer: 1,
            type: 'answer',
            data: 'decline',
          }))

        this.peer.off('data', this.bindedSendConfigCheck)
        this.isReceiving = true
        this.recvProperties.percentCallback = callback
        this._waitForFile()

        this.peer.send(JSON.stringify({
          speer: 1,
          type: 'answer',
          data: 'accept',
        }))
      })

    this.onRequest(request)
  }

  _handleRequestAnswer(data) {
    if(data.data == 'accept') {
      this.peer._channel.bufferedAmountLowThreshold = this.sendProperties.chunkSize * this.sendProperties.chunkCountInBatch * 0.3
      this.peer._channel.addEventListener('bufferedamountlow', this.bindedSendFileChunks)
      this._sendFile()
    }
    else {
      this.onDecline()
      this.isSending = false
      this.sendProperties.resolve()
    }
  }

  async _sendFile() {
    this.peer.off('data', this.bindedSendConfigCheck)

    console.time('file sending')

    this._sendFileChunks()
  }

  _waitForFile() {
    this.recvProperties.fileBuffer = []
    this.peer.off('data', this.bindedRequestConfigCheck)

    if(this.recvProperties.mode == 'accumulate')
      this.bindedOnData = this._accumulateChunks.bind(this)
    else
      this.bindedOnData = this._emitChunks.bind(this)

    this.peer.on('data', this.bindedOnData)
    console.time('file receiving')
  }

  async _sendFileChunks() {
    const startIndex = this.sendProperties.chunkIndex * this.sendProperties.chunkSize
    this.sendProperties.buffer = await this.sendProperties.file.slice(startIndex, startIndex+this.sendProperties.chunkSize*this.sendProperties.chunkCountInBatch).arrayBuffer()

    for(let start=0; start<this.sendProperties.buffer.byteLength; start+=this.sendProperties.chunkSize) {
      this.peer.send(this.sendProperties.buffer.slice(start, start+this.sendProperties.chunkSize))
      ++this.sendProperties.chunkIndex
    }
    
    this.sendProperties.percentCallback(this.sendProperties.chunkIndex/this.sendProperties.chunkCount)
    
    if(this.sendProperties.chunkIndex == this.sendProperties.chunkCount) {
      console.timeEnd('file sending')
      this.sendProperties.resolve()
      this.sendProperties.percentCallback(1)
      this._initSend()
      this._initRecv()
    }
  }

  _accumulateChunks(chunk) {
    ++this.recvProperties.chunkIndex
    
    if(this.recvProperties.chunkIndex % this.percentCallBackFreq == 0)
      this.recvProperties.percentCallback(this.recvProperties.chunkIndex/this.recvProperties.chunkCount)

    this.recvProperties.fileBuffer.push(chunk)
    
    if(this.recvProperties.chunkCount == this.recvProperties.chunkIndex) {
      console.timeEnd('file receiving')

      this.onReceive(new File(this.recvProperties.fileBuffer, this.recvProperties.file.name, this.recvProperties.file))
      this.recvProperties.percentCallback(1)

      this._initRecv()
    }
  }

  _emitChunks(chunk) {
    ++this.recvProperties.chunkIndex
    
    if(this.recvProperties.chunkIndex % this.percentCallBackFreq == 0)
      this.recvProperties.percentCallback(this.recvProperties.chunkIndex/this.recvProperties.chunkCount)

    this.onReceive(chunk)
    
    if(this.recvProperties.chunkCount == this.recvProperties.chunkIndex) {
      console.timeEnd('file receiving')

      this.onReceive(new Uint8Array())
      this.recvProperties.percentCallback(1)

      this._initRecv()
    }
  }

  _initSend() {
    this.peer.off('data', this.bindedSendConfigCheck)

    this.peer._channel.removeEventListener('bufferedamountlow', this.bindedSendFileChunks)

    this.sendProperties = {
      resolve: null,
      file: null,
      percentCallback: null,
      chunkCount: 0,
      chunkIndex: 0,
      chunkSize: 64*1024,
      chunkCountInBatch: 100,
    }

    this.peer.on('data', this.bindedSendConfigCheck)
    this.isSending = false
  }

  _initRecv() {
    this.peer.off('data', this.bindedRequestConfigCheck)

    if(this.bindedOnData) {
      this.peer.off('data', this.bindedOnData)
      this.bindedOnData = null
    }

    this.recvProperties = {
      file: null,
      percentCallback: null,
      chunkCount: 0,
      chunkIndex: 0,
      fileBuffer: [],
      mode: 'emit',
    }

    this.peer.on('data', this.bindedRequestConfigCheck)
    this.isReceiving = false
  }

  _sendConfigCheck(data) {
    data = JSON.parse(data)

    if(data.speer && data.type == 'answer') {
      this._handleRequestAnswer(data)
    }
  }

  _requestConfigCheck(data) {
    data = JSON.parse(data)

    if(data.speer && data.type == 'request') {
      this._handleRequest(data)
    }
  }

  _handleChannelError(error) {
    console.error("SimplePeer ERROR", error)

    if(error.code !== 0) return
    this.onClose()
  }

  // TO IMPLEMENT BY DEVELOPER
  onDecline() { Logger.log('You have to implement the !<onDecline>! function yourself!') }
  onRequest() { Logger.log('You have to implement the !<onRequest>! function yourself!') }
  onReceive() { Logger.log('You have to implement the !<onReceive>! function yourself!') }
  onClose() { Logger.log('You have to implement the !<onClose>! function yourself!') }
}

class FileSendRequest {
  constructor(fileData) {
    this.file = fileData
  }

  _answered() {
    return new Promise(resolve => this.answer = resolve)
  }

  accept(callback) {
    this.answer({accepted: true, callback})
  }
  
  decline() {
    this.answer({accepted: false})
  }
}

class CallConnection {
  constructor(peer) {
    this.isInCall = false

    this.peer = peer
    this.configConnection = new Connection(peer)
    this.configConnection.onData = this._handleConfigData.bind(this)

    this.peer.on('error', this._handleChannelError.bind(this))
    this.peer.on('signal', peerData =>
      this.configConnection.send({
        signal: true,
        peerData
      })
    )
    this.peer._onChannelClose = this._handleChannelError.bind(this) // TODO: Use the "close" event
  }

  call(stream, data) {
    if(this.isInCall) return Promise.reject()
    this.isInCall = true
    
    return new Promise( resolve => {
      this.stream = stream
      this.callResolve = resolve

      this.configConnection.send({
        type: 'request',
        data,
      })

      this.peer.on('stream', this.onStream)
      this.peer.on('track', this.onTrack)
    })
  }

  end() {
    this._resetCall(true)
    this.configConnection.send({type: 'end'})
  }

  close() {
    this.peer.destroy({error: true})
  }

  _handleConfigData(data) {
    if(data.signal) return this.peer.signal(data.peerData)

    switch(data.type) {
      case 'request': this._handleRequest(data); break;
      case 'answer': this._handleRequestAnswer(data); break;
      case 'end': this._resetCall(); break;
    }
  }

  _handleRequest(data) {
    const request = new CallRequest(data.data)
    request._answered()
      .then( accepted => {
        if(!accepted) {
          return this.configConnection.send({
            type: 'answer',
            data: 'decline',
          })
        }
        
        this._waitForCall(accepted)
        this.configConnection.send({
          type: 'answer',
          data: 'accept',
        })
      })

    this.onRequest(request)
  }

  _handleRequestAnswer(data) {
    if(data.data == 'accept') {
      this.callResolve()
      this._makeCall()
    }
    else {
      this.isInCall = false
      this.onDecline()
    }
  }

  _makeCall() {
    try {
      this.peer.addStream(this.stream)
    } catch(err) {}
  }

  _waitForCall(stream) {
    this.isInCall = true
    this.stream = stream
    this.peer.addStream(stream)
    
    this.peer.on('stream', remoteStream => this.onStream(remoteStream) )
    this.peer.on('track', (remoteTrack, remoteStream) => this.onTrack(remoteTrack, remoteStream) )
  }

  _resetCall(initiator = false) {
    try {
      this.peer.removeStream(this.stream)
    } catch(err) {}

    if(!initiator) this.onEnd()
    this.isInCall = false
  }

  _handleChannelError(error) {
    console.error("SimplePeer ERROR", error)

    this.isInCall = false
    this.onClose()
  }

  // TO IMPLEMENT BY DEVELOPER
  onDecline() { Logger.log('You have to implement the !<onDecline>! function yourself!') }
  onRequest() { Logger.log('You have to implement the !<onRequest>! function yourself!') }
  onStream() { Logger.log('You have to implement the !<onStream>! function yourself!')}
  onTrack() { Logger.log('You have to implement the !<onTrack>! function yourself!')}
  onEnd() { Logger.log('You have to implement the !<onEnd>! function yourself!')}
  onClose() { Logger.log('You have to implement the !<onClose>! function yourself!') }
}

class CallRequest {
  constructor(properties) {
    this.properties = properties
  }

  _answered() {
    return new Promise(resolve => this.answer = resolve)
  }

  accept(stream) {
    this.answer(stream)
  }
  
  decline() {
    this.answer(false)
  }
}

// A class for writing meaningful and more readable messages for the developer
class Logger {
  static tokens = [
    ['1<', '>1', 'font-size: 24px; margin: 5px 0px;'],
    ['2<', '>2', 'font-size: 20px; margin: 3px 0px;'],
    ['3<', '>3', 'font-size: 16px; margin: 2px 0px;'],
    ['!<', '>!', 'background: #ff5959; padding: 3px 5px; border-radius:2px; font-weight: bold; color: #333;'],
    ['_<', '>_', 'text-decoration: underline;'],
    ['/<', '>/', 'color: #a3a3a3; font-style: italic; border-left: 3px solid #a3a3a3; padding: 3px 0 3px 5px;'],
    ['r<', '>r', 'color: #ff5959; border-color: #ff5959;'],
    ['g<', '>g', 'color: #4CAF50; border-color: #4CAF50;'],
    ['b<', '>b', 'color: #00a2ff; border-color: #00a2ff;'],
    ['[<', '>]', 'background: no-repeat url(@); line-height: 0; font-szie: 0; padding: 90px calc(100% / 2); background-size: contain;'],
  ]

  // Parses the given template string 
  static _generateString(str) {
    let stack = ['color: #333; font-family: Impact, Charcoal, sans-serif; font-size: 13px;']
    let args  = []

    for(let i=0; i<str.length-1; ++i) {
      let nextTwoLetters = str[i] + str[i+1]
      let token = Logger.tokens.filter(token => token[0] == nextTwoLetters || token[1] == nextTwoLetters)[0]
      if(!token) continue

      let opening = token[0] == nextTwoLetters
      
      if(opening) {
        let style = token[2]
        if(token[0] == '[<') {
          let url = str.slice(i+2, str.indexOf('>]', i+2))
          style = token[2].replace('@', url)
          str = str.replace(url, ' ')
        }
        stack.push(style)
      }
      else stack.pop()
      
      args.push(stack.join(' '))
      str = str.replace(token[opening ? 0 : 1], '%c')

      i++
    }

    return [str, ...args]
  }

  // Prints a 'basic' log to the console (white background)
  static log(str) {
    let args = Logger._generateString(str)
    console.log(...args)
  }

  // Prints a 'warning' log to the console (yellow background)
  static warn(str) {
    let args = Logger._generateString(str)
    console.warn(...args)
  }

  // Prints an 'error' log to the console (red background)
  static error(str) {
    let args = Logger._generateString(str)
    console.error(...args)
  }

  // Showcases all the functionality of the logger classes templates
  static showcase() {
    let str = '\n'

    for(let token of Logger.tokens) {
      if(token[0] == '[<') continue
      str += `${token[0]}Lorem ipsum dolor sit amet${token[1]}\n`
    }
    
    str += 'Lorem ipsum dolor sit amet\n'
    str += '[<https://i.cloudup.com/Zqeq2GhGjt-3000x3000.jpeg>]\n'

    console.log('')
    Logger.log(str)
    console.log('')
    Logger.warn(str)
    console.log('')
    Logger.error(str)
  }
}

// Logger.showcase()