const sessionParser   = require('./globals/sessionParser')
const compression     = require('compression')
const bodyParser      = require('body-parser')
const mongoose        = require('mongoose')
const express         = require('express')
const config          = require('./config.json')
const helmet          = require('helmet')
const https           = require('https')
const http            = require('http')
const cors            = require('cors')
const path            = require('path')
const fs              = require('fs')

const Routes          = require('./routes.js')

const BACKEND_PORT    = 9001
const FRONTEND_PORT   = 443

// ------- BACKEND -------
const backend         = express()

console.log('MODE:', process.env.NODE_ENV || 'development')

mongoose.set('useCreateIndex', true)
mongoose.connect('mongodb://localhost:27017/speer', {useNewUrlParser: true, useUnifiedTopology: true})
  .then( () => console.log('Ready to use MongoDB!') )
  .catch( err => console.error(err) )

// Basic server configs
backend.use( bodyParser.json({limit: '1mb'}) )
backend.use( bodyParser.urlencoded({limit: '1mb', extended: true}) )
backend.use( cors({
  credentials: true,
  origin: process.env.NODE_ENV == 'production' ? ['https://speer.fun'] : ['http://localhost:9000', 'https://speer.fun']
}))

backend.use((req, res, next) => {
  try {
    sessionParser(req, res, next)
  } catch(err) {
    res.status(401).send('You are not authenticated')
  }
})
backend.use(Routes)

let backendServer = http.createServer(backend)
if(process.env.NODE_ENV == 'production')
  backendServer = https.createServer({
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  }, backend)

backendServer.listen(BACKEND_PORT, null, null, () => console.log('The dark side of the 🌑 is ready!') )

// ------- FRONTEND -------
if(process.env.NODE_ENV == 'production') {
  const frontend = express()
  const frontend_http = express()

  frontend.use( cors({
    origin: process.env.NODE_ENV == 'production' ? ['https://speer.fun'] : ['http://localhost:9000', 'https://speer.fun']
  }))
  frontend.use( compression() )
  frontend.use( helmet({
    contentSecurityPolicy: false,
  }) )
  frontend.use( helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "default-src": ["'self'", "https://speer.fun:9001", "wss://speer.fun:9002", "wss://speer.fun:9003", "https://jimmywarting.github.io/"],
      "img-src": ["'self'", "blob:", "https://speer.fun:9001"],
      "script-src": [
        "'self'",
        "'sha256-tempUn1btibnrWwQxEk37lMGV1Nf8FO/GXxNhLEsPdg='", // needed because nuxt inlines some stuff :/
        "'sha256-YvYJ5WVzt8kOVVuSB9YcyVJLN4a6HcbOgQpzrg0BLUI='", // needed because nuxt inlines some stuff :/
        "https://cdn.jsdelivr.net/npm/workbox-cdn@5.1.4/workbox/",
      ],
    },
  }) )

  frontend.use('/', express.static(path.resolve(__dirname, '../dist/')))

  frontend_http.use ( (req, res) => res.redirect('https://' + req.headers.host + req.url) ) // REDIRECT TO HTTPS FROM HTTP
  frontend_http.listen(80)
  
  https.createServer({
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  }, frontend).listen(FRONTEND_PORT, null, null, () => console.log('The bright side of the 🌑 is ready'))
}