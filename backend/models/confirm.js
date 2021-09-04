const mongoose = require('mongoose')

const ConfirmSchema = mongoose.Schema({
  user: {type: mongoose.Schema.Types.ObjectId, ref: 'Confirm', required: true},
  token: {type: String, required: true},
})

module.exports = mongoose.model('Confirm', ConfirmSchema)