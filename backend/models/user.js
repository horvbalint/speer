const mongoose = require('mongoose')

const UserSchema = mongoose.Schema({
  email: {type: String, required: true, unique: true, trim: true},
  password: {type: String, required: true},
  username: {type: String, required: true, minlength: 1, maxlength: 25, validate: /^[A-Za-z0-9 _]+$/},
  avatar: {type: String, default: 'avatar.jpg'},
  requests: {type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: []},
  friends: {type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: []},
  devices: {type: [new mongoose.Schema({
    name: {type: String, trim: true},
    endpoint: {type: String},
    subscription: {type: mongoose.Schema.Types.Mixed}
  })], default: []},
  admin: {type: Boolean, default: false},
  confirmed: {type: Boolean, default: false},
  deleted: {type: Boolean, default: false},
})

module.exports = mongoose.model('User', UserSchema)