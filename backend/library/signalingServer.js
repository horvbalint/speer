const WebSocket = require('ws')
const SessionParser = require('../globals/sessionParser')

// A class that creates a WebSocket server and handles all the work of a Signal Server
module.exports = class SignalingServer {
  constructor(server, port, validateSignal = () => Promise.resolve(), onConnect = this.logStatus, onClose = this.logStatus) {
    this.connectedSockets = {}
    this.validateSignal = validateSignal
    this.onConnect = onConnect
    this.onClose = onClose
    this.wss = new WebSocket.Server({
      server,
      verifyClient: (info, done) => {
        try {
          SessionParser(info.req, {}, () => done(info.req.session?.passport?.user))
        } catch(err) {
          done(false)
        }
      }
    })

    this.wss.on('connection', (ws, req) => {
      try {
        SessionParser(req, {}, () => {
          if(this.connectedSockets[req.session.passport.user]) this.removeClient(req.session.passport.user)
    
          ws.speerId = req.session.passport.user
          ws.isAlive = true
          this.connectedSockets[req.session.passport.user] = ws
          this.onConnect(req.session.passport.user)
    
          ws.on( 'message', message => this.handleSignal(message, ws) )
          ws.on( 'pong', () => ws.isAlive = true )
          ws.on( 'close', event => this.handleClose(event, ws) )
          ws.on( 'error', event => this.handleClose(event, ws) )
        })
      } catch(err) {
        ws.terminate()
      }
    })

    server.listen(port)
    setInterval(this.sendHeartbeats.bind(this), 10000)
  }

  handleClose( event, ws ) {
    for(const Id in this.connectedSockets)
      if(this.connectedSockets[Id] == ws) {
        this.connectedSockets[Id].terminate()
        delete this.connectedSockets[Id]

        this.onClose(Id)
        break
      }
  }

  handleSignal(message, ws) {
    message = JSON.parse(message)

    this.validateSignal(ws.speerId, message.remoteId)
      .then( () => {
        if(!this.connectedSockets[message.remoteId]) return
    
        const rawMessage = {
          action: 'signal',
          peerData: message.peerData,
          remoteId: ws.speerId,
          type: message.type,
          data: message.data
        }
        this.connectedSockets[message.remoteId].send( JSON.stringify(rawMessage) )
      })
      .catch( err => {
        ws.send(JSON.stringify({
          error: 'Not friend',
          remoteId: message.remoteId
        }))
      })
  }

  removeClient(Id) {
    this.connectedSockets[Id].terminate()
    delete this.connectedSockets[Id]
    
    this.onClose(Id)
  }

  sendHeartbeats() {
    for(let Id in this.connectedSockets) {
      if(!this.connectedSockets[Id].isAlive) {
        this.removeClient(Id)
        continue
      }

      this.connectedSockets[Id].isAlive = false
      this.connectedSockets[Id].ping()
    }
  }

  getConnectedIds() {
    return Object.keys(this.connectedSockets)
  }

  logStatus() {
    console.log('CONNECTED IDs: ', this.getConnectedIds())
  }
}