const config          = require('../config.json')
const https           = require('https')
const http            = require('http')
const fs              = require('fs')
const SignalingServer = require('../library/signalingServer')

const WS_PORT         = 9002

let wssServer = http.createServer()
if(process.env.NODE_ENV == 'production')
  wssServer = https.createServer({
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  })

module.exports = new SignalingServer(wssServer, WS_PORT)