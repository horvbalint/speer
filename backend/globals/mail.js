const mailjet     = require('./mailjet')
const path        = require('path')
const fs          = require('fs')

function sendEmailConfirmation(username, email, token) {
  return new Promise( (resolve, reject) => {
    if(process.env.NODE_ENV != 'production') {
      console.log('CONFIRMATION URL: \n', `http://localhost:9000/login/?confirmToken=${token}`)
      return resolve()
    }

    fs.promises.readFile(path.resolve(__dirname, '../emails/emailConfirmation.html'), 'utf8')
      .then( html => {
        html = html.replace(/\{\{USERNAME\}\}/g, username)
        html = html.replace(/\{\{URL\}\}/g, `https://speer.fun/login/?confirmToken=${token}`)

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
