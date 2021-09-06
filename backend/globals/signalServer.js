const mongoose        = require('mongoose')
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

module.exports = new SignalingServer(wssServer, WS_PORT, (localId, remoteId) => {
  return new Promise( (resolve, reject) => {
    mongoose.model('User').findOne({_id: localId}, {friends: 1}).lean()
      .then( user => {
        let friend = user.friends.find( f => String(f) == remoteId )

        if(friend) resolve()
        else reject()
      })
      .catch( err => reject(err) )
  })
})