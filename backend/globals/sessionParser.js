const config          = require('../config.json')
const cookieSession   = require('cookie-session')

module.exports = cookieSession({
  name: 'speer',
  secret: config.cookie.secret,
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
  sameSite: 'lax',
  secure: process.env.NODE_ENV == 'production',
})
