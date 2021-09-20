const mongoose = require('mongoose')

const FeedbackSchema = mongoose.Schema({
  description: {type: String, required: true, maxlength: 2000},
  stepsToReproduce: [{type: String, maxlength: 500}],
  type: {type: String, enum: ['suggestion', 'bug', 'other']},
  version: {type: String, maxlength: 50},
})

module.exports = mongoose.model('Feedback', FeedbackSchema)