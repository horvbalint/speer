const WebSocket = require('ws')
const SessionParser = require('../globals/sessionParser')

// A class that creates a WebSocket server and handles event based realtime communication
module.exports = class Pusher {
  constructor(server, port, onOpen = this.logStatus, onClose = this.logStatus) {
    this.connectedSockets = {}
    this.subscriptions = {}
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

    this.onOpen = onOpen
    this.onClose = onClose

    this.wss.on('connection', (ws, req) => {
      try {
        SessionParser(req, {}, () => {
          if(this.connectedSockets[req.session.passport.user]) this.removeClient(req.session.passport.user)
  
          ws.pusherId = req.session.passport.user
          ws.isAlive = true
          this.connectedSockets[req.session.passport.user] = ws,
              
          this.onOpen.call(this, req.session.passport.user)
  
          ws.on( 'message', message => this.handleMessage(message, ws) )
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

  handleMessage(message, ws) {
    message = JSON.parse(message)

    switch(message.action) {
      case 'subscribe':   this.handleSubscription(message.event, ws); break;
      case 'unsubscribe': this.handleUnsubscription(message.event, ws); break;
    }    
  }

  handleSubscription(event, ws) {
    if(!this.connectedSockets[ws.pusherId]) return ws.terminate()

    if(!this.subscriptions[event]) this.subscriptions[event] = []
    this.subscriptions[event].push(ws)
  }

  handleUnsubscription(event, ws) {
    if(!this.subscriptions[event]) return
    
    this.subscriptions[event] = this.subscriptions[event].filter( socket => socket != ws )
  }

  handleClose( _, ws ) {
    for(let event in this.subscriptions)
      this.subscriptions[event] = this.subscriptions[event].filter( socket => socket != ws )

    for(const Id in this.connectedSockets)
      if(this.connectedSockets[Id] == ws) {
        this.connectedSockets[Id].terminate()
        delete this.connectedSockets[Id]

        this.onClose.call(this, Id)
        
        break
      }
  }

  dispatch({event, data, filter = null, prepareData = ({data}) => Promise.resolve(data)}) {
    if(!this.subscriptions[event]) return

    for(let socket of this.subscriptions[event]) {
      if(filter && !filter.includes(socket.pusherId)) continue
      
      prepareData({id: socket.pusherId, data})
      .then( data => {
        socket.send(JSON.stringify({event, data}))
      })
      .catch( err => console.error(`Failed to send data to '${socket.pusherId}'. Reason: ${err}`) )
    }
  }

  removeClient(Id) {
    for(let event in this.subscriptions)
      this.subscriptions[event] = this.subscriptions[event].filter( socket => socket != this.connectedSockets[Id] )

    this.connectedSockets[Id].terminate()
    delete this.connectedSockets[Id]
    
    this.onClose.call(this, Id)
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
    console.log('PUSHER IDs: ', this.getConnectedIds())
  }
}