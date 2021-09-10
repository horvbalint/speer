const SignalServer    = require('./globals/signalServer')
const changelog       = require('./changelog')
const mongoose        = require('mongoose')
const passport        = require('passport')
const Confirm         = require('./models/confirm')
const express         = require('express')
const webpush         = require('web-push')
const config          = require('./config.json')
const Pusher          = require('./globals/pusher')
const bcrypt          = require('bcrypt')
const multer          = require('multer')
const sharp           = require('sharp')
const User            = require('./models/user')
const path            = require('path')
const mail            = require('./globals/mail')
const jwt             = require('jwt-encode')
const fs              = require('fs')

const LocalStrategy   = require('passport-local').Strategy
const router          = express.Router()
const upload          = multer({
  dest: path.resolve(__dirname, './files'),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
})

webpush.setVapidDetails(
  `mailto:${config.vapid.mailto}`,
  config.vapid.public,
  config.vapid.private
)
console.log("WebPush ready")

passport.use( new LocalStrategy({
    usernameField: 'email',
  },
  (email, password, done) => {
    User.findOne({email: email}, (err, user) => {
      if(err) return done(err)
      if(!user) return done(null, false, 'Incorrect credentials')
      if(user.deleted) return done(null, false, 'User deactivated')
      if(!user.confirmed) return done(null, false, 'Email not confirmed')
      if(!bcrypt.compareSync(password, user.password)) return done(null, false, 'Incorrect credentials')

      return done(null, user)
    })
  }
))

passport.serializeUser( (user, done) => {
  done(null, user._id)
})

passport.deserializeUser( (id, done) => {
  User.findById(id,  (err, user) => {
    done(err, user)
  }).lean()
})

router.use(passport.initialize())
router.use(passport.session())

router.post('/register', (req, res) => {
  User.exists({email: req.body.email})
    .then( exists => {
      if(exists) return res.status(400).send('Email in use')
      
      User.create({
        email: req.body.email,
        username: req.body.username,
        password: bcrypt.hashSync(req.body.password, 10)
      })
        .then( user => {
          return Confirm.create({
            user: user._id,
            token: jwt(user.email, config.confirm.secret)
          })
        })
        .then( confirm => {
          mail.sendEmailConfirmation(req.body.username, req.body.email, confirm.token)
    
          res.send('ok')
        })
        .catch( err => {
          if(err?.errors?.username?.properties?.type == 'user defined')
            res.status(400).send('Invalid chars')
          else
            res.status(500).send('Failed')
          
          User.deleteOne({email: req.body.email})
            .catch( err => console.error(err) )
        })
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/login', (req, res) => {
  passport.authenticate('local', (err, user, info) => {
    if(err) return res.status(500).send(err)
    if(!user) return res.status(401).send(info)

    req.login(user, err => {
      if(err) res.status(500).send(err)
      else res.send()
    })
  })(req, res)
})

router.post('/logout', (req, res) => {
  req.logout()
  res.send()
})

router.post('/confirm/:token', (req, res) => {
  Confirm.findOne({token: req.params.token})
    .then( confirm => {
      if(!confirm) return res.status(400).send('Invalid token')

      User.updateOne({_id: confirm.user}, {$set: {confirmed: true}})
        .then( () => {
          res.send('ok')
          
          Confirm.deleteOne({token: req.params.token})
          .catch( err => console.error(err) )
        })
        .catch( err => {
          console.error(err)
          res.status(500).send(err)
        })
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/cancel/:token', (req, res) => {
  Confirm.findOne({token: req.params.token})
    .then( confirm => {
      if(!confirm) return res.status(400).send('Invalid token')

      User.deleteOne({_id: confirm.user, confirmed: false})
        .then( () => {
          res.send('ok')
          
          Confirm.deleteOne({token: req.params.token})
          .catch( err => console.error(err) )
        })
        .catch( err => {
          console.error(err)
          res.status(500).send(err)
        })
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/resendConfirmation/:email', (req, res) => {
  User.findOne({email: req.params.email, confirmed: false, deleted: false})
    .then( user => {
      if(!user) return res.status(400).send('Invalid email')
      
      Confirm.findOne({user: user._id})
        .then( confirm => {
          if(!confirm) return res.status(400).send('Invalid email')
      
          mail.sendEmailConfirmation(user.username, user.email, confirm.token)
          res.send('ok!')
        })
        .catch( err => {
          console.error(err)
          res.status(500).send(err)
        })
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

// ROUTES WITH AUTHENTICATION
router.use( (req, res, next) => {
  if (!req.isAuthenticated()) res.status(401).send('You are not authenticated')
  else next()
})

router.post('/avatar', upload.single('avatar'), (req, res) => {
  let extension = req.file.mimetype.split('/').pop()
  let filename  = `${req.file.filename}.${extension}`

  sharp(path.resolve(__dirname, './files/', req.file.filename))
  .resize(200, 200, {
    fit: 'outside',
    withoutEnlargement: true,
  })
  .toFile(path.resolve(__dirname, './files/', filename), err => {
    fs.promises.unlink(path.resolve(__dirname, './files/', req.file.filename))
      .catch( err => console.error(err) )
      .finally( () => {
        if(err) return res.status(500).send('Failed to resize')
    
        User.updateOne({_id: req.user._id}, {avatar: filename})
          .then( () => res.send(filename) )
          .catch( err => {
            console.error(err)
            res.status(500).send(err)
          })

        if(req.user.avatar != 'avatar.jpg')
          fs.promises.unlink(path.resolve(__dirname, './files/', req.user.avatar))
            .catch( err => console.error(err) )
      })
  })
})

router.get('/me', (req, res) => {
  delete req.user.password
  delete req.user.admin
  for(let device of req.user.devices) {
    delete device.endpoint
    delete device.subscription
  }

  res.send(req.user)
})

router.get('/onlines', (req, res) => {
  let friends = req.user.friends.map( id => String(id) )
  let onlines = SignalServer.getConnectedIds().filter( id => friends.includes(id) )
  res.send(onlines)
})

router.get('/online/:id', (req, res) => {
  if(!req.user.friends.find(id => String(id) == req.params.id))
    return res.status(403).send('Not friend')

  let online = SignalServer.getConnectedIds().find( id => id == req.params.id )
  res.send(!!online)
})

router.get('/user/:email', (req, res) => {
  User.findOne(
    {
      email: req.params.email,
      _id: {$not: {$in: req.user.friends}},
      deleted: false,
      confirmed: true
    },
    {
      username: 1,
      email: 1,
      avatar: 1
    }
  ).lean()
  .then( user => {
    if(!user || String(user._id) == String(req.user._id)) res.send(null)
    else res.send(user)
  })
  .catch( err => {
    console.error(err)
    res.status(500).send(err)
  })
})

router.get('/friends', (req, res) => {
  User.find({deleted: false, confirmed: true, _id: req.user.friends}, {username: 1, email: 1, avatar: 1}).lean()
    .then( friends => res.send(friends) )
    .catch( err => {
      console.errror(err)
      res.status(500).send(err)
    })
})

router.post('/request/:id', (req, res) => {
  if(String(req.user._id) == req.params.id)
    return res.status(400).send('Make peace with yourself')

  User.findOne({_id: req.params.id, deleted: false, confirmed: true})
    .then( user => {
      if(!user) return res.status(400).send('User not found')

      if(user.friends.includes(req.user._id))
        return res.status(400).send('Already friend')

      User.updateOne({_id: req.params.id}, {$addToSet: {requests: req.user._id}})
        .then( () => {
          let requester = {
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            avatar: req.user.avatar,
          }
          Pusher.dispatch({event: 'request', data: requester, filter: [req.params.id]})
          return User.findById(req.params.id)
        })
        .then( user => sendNotifications(user, `${req.user.username} sent you a friend request!`, `${req.user.email}`) )
        .then( () => res.send() )
        .catch( err => {
          console.error(err)
          res.status(500).send(err)
        })
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.get('/request', (req, res) => {
  User.find({_id: req.user.requests, confirmed: true, deleted: false}, {username: 1, email: 1, avatar: 1})
    .then( requests => res.send(requests) )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/accept/:id', (req, res) => {
  if(!req.user.requests.some( id => String(id) == req.params.id) )
    return res.status(400).send('Not in requests')

  User.updateOne({_id: req.user._id}, {$pull: {requests: req.params.id}, $addToSet: {friends: req.params.id}})
    .then( () => User.updateOne({_id: req.params.id}, {$addToSet: {friends: req.user._id}}) )
    .then( () => {
      let user = {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
      }

      Pusher.dispatch({event: 'friend', data: user, filter: [req.params.id]})
      return User.findById(req.params.id)
    })
    .then( user => sendNotifications(user, 'New friend!', `${req.user.username} accepted your friend request!`) )
    .then( () => res.send() )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/decline/:id', (req, res) => {
  if(!req.user.requests.some( id => String(id) == req.params.id) )
    return res.status(400).send('Not in requests')

  User.updateOne({_id: req.user._id}, {$pull: {requests: req.params.id}})
    .then( () => res.send() )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/addDevice', (req, res) => {
  req.body.name = req.body.name.trim()
  if( req.user.devices.some(d => d.name == req.body.name) )
    return res.status(400).send('Name collision')

  let deviceId = mongoose.Types.ObjectId()
  User.updateOne({_id: req.user._id}, {$push: {devices: {_id: deviceId, ...req.body}}})
    .then( () => {
      res.send({_id: deviceId, name: req.body.name})

      sendNotifications({
        _id: req.user._id,
        devices: [{_id: deviceId, ...req.body}]
      }, 'Device registered!', `Device '${req.body.name}' is ready to be used.`)
        .catch( err => console.error(err) )
    })
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/pushsubscriptionchange', (req, res) => {
  if(!req.body.oldEndpoint) return res.status(400).send('No device')

  let promise = null

  if(!req.body.newEndpoint)
    promise = User.updateOne({_id: req.user._id}, {
      $set: {
        devices: req.user.devices.filter( device => device.endpoint != req.body.oldEndpoint )
      }
    })
  else {
    let device = req.body.devices.find( device => device.endpoint == req.body.oldEndpoint )
    if(!device) return res.status(400).send('No device')
    if(!req.body.subscription) return res.status(400).send('No subscription')

    device.endpoint = req.body.newEndpoint
    device.subscription = req.body.subscription
    promise = User.updateOne({_id: req.user._id}, {$set: {devices: req.user.devices}})
  }
  
  promise
    .then( () => res.send() )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.delete('/removeDevice/:id', (req, res) => {
  let device = req.user.devices.find( d => String(d._id) == req.params.id )
  if(!device) return res.status(400).send('No such device')

  User.updateOne({_id: req.user._id}, {$pull: {devices: device}})
    .then( () => res.send() )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/testDevices', (req, res) => {
  let title = 'Test notification!'
  let body = 'This device is set up properly, if you see this message.'

  sendNotifications(req.user, title, body)
    .then( devices => res.send(devices.map(d => ({_id: d._id, name: d.name}))) )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.post('/ping/', (req, res) => {
  if(req.user.friends.includes(req.body.id))
    return res.status(400).send('Not friend')

  let title = `${req.user.username} pinged you!`
  let body = req.body.message.slice(0, 50) || `${req.user.username} needs you online.`

  User.findById(req.body.id)
    .then( user => sendNotifications(user, title, body) )
    .then( devices => res.send(!!devices.length) )
    .catch( err => {
      console.error(err)
      res.status(500).send(err)
    })
})

router.get('/changelog/:version', (req, res) => {
  if(!changelog[req.params.version])
    return res.status(400).send('No such version')

  let versions = Object.keys(changelog)
  let to = versions.indexOf(req.params.version)
  let changes = {}

  for(let version of versions.slice(0, to))
    changes[version] = changelog[version]
  
  res.send(changes)
})

router.get('/changelog', (req, res) => {
  res.send(changelog)
})

router.get('/breaking/:version', (req, res) => {
  if(!changelog[req.params.version])
    return res.status(400).send('No such version')

  let versions = Object.keys(changelog)
  let to = versions.indexOf(req.params.version)

  for(let version of versions.slice(0, to)) {
    if(changelog[version].type == 'breaking')
      return res.send(true)
  }

  res.send(false)
})

router.post('/log', (req, res) => {
  if(!req.user.admin) return res.status(401).send('You are not an admin!')

  console.log('Connected Ids:', SignalServer.getConnectedIds())
  res.send()
})

router.use('/static', express.static(path.resolve(__dirname, './files')))

function sendNotifications(user, title, body) {
  return new Promise( (resolve, reject) => {
    let promises = user.devices.map( device =>
      webpush.sendNotification(device.subscription, JSON.stringify({title, body}))
    )
  
    Promise.allSettled(promises)
      .then( results => {
        let notExpiredDevices = user.devices.filter( (_, i) => !(results[i].status == 'rejected' && results[i].reason.statusCode == 410) )
        
        if(notExpiredDevices.length != user.devices.length)
          User.updateOne({_id: user._id}, {$set: {devices: notExpiredDevices}})
            .then( () => resolve(notExpiredDevices) )
        else
          resolve(notExpiredDevices)
      })
      .catch( err => reject(err) )
  })
}

SignalServer.onConnect = id => {
  User.find({friends: id})
    .then( users => Pusher.dispatch({event: 'login', data: id, filter: users.map(u => String(u._id))}) )
    .catch( err => console.error(err) )
}

SignalServer.onClose = id => {
  User.find({friends: id})
    .then( users => Pusher.dispatch({event: 'logout', data: id, filter: users.map(u => String(u._id))}) )
    .catch( err => console.error(err) )
}

module.exports = router