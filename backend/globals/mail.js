const mailjet     = require('./mailjet')
const path        = require('path')
const fs          = require('fs')

function sendEmailConfirmation(username, email, token) {
  return new Promise( (resolve, reject) => {
    if(process.env.NODE_ENV != 'production') {
      console.log('CONFIRM REGISTRATION: \n', `http://localhost:9000/confirm?token=${token}`)
      console.log('CANCEL REGISTRATION: \n', `http://localhost:9000/cancel?token=${token}`)
      return resolve()
    }

    fs.promises.readFile(path.resolve(__dirname, '../emails/emailConfirmation.html'), 'utf8')
      .then( html => {
        html = html.replace(/\{\{CONFIRM_URL\}\}/g, `https://speer.fun/confirm?token=${token}`)
        html = html.replace(/\{\{CANCEL_URL\}\}/g, `https://speer.fun/cancel?token=${token}`)
        html = html.replace(/\{\{USERNAME\}\}/g, username)

        mailjet
          .post('send', {version: 'v3.1'})
          .request({
            Messages:[
              {
                From: {
                  Email: 'noreply@speer.fun',
                  Name: 'Speer'
                },
                To: [
                  {
                    Email: email,
                    Name: username
                  }
                ],
                Subject: 'Speer - Confirm your email',
                HTMLPart: html
              }
            ]
          })
          .then( res => resolve(res) )
          .catch( err => {
            console.error(err)
            reject(err)
          })
      })
      .catch( err => {
        console.error(err)
        reject(err)
      })
  })
}

module.exports = {
  sendEmailConfirmation
}
