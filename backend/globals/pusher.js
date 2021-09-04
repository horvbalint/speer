const https           = require('https')
const http            = require('http')
const fs              = require('fs')
const Pusher          = require('../library/pusher')
const config          = require('../config.json')

const WS_PORT         = 9003

let wssServer = http.createServer()
if(process.env.NODE_ENV == 'production')
  wssServer = https.createServer({
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  })

module.exports = new Pusher(
  wssServer,
  WS_PORT,
)