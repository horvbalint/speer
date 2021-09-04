const mailjet = require ('node-mailjet')
const config = require ('../config.json')

if(process.env.NODE_ENV != 'production')
  module.exports = null
else
  module.exports = mailjet.connect(config.mailjet.public, config.mailjet.private)

