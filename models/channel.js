const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')



const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  },
  moderated: {
    type: Boolean
  },
  signup_date: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
})

channelSchema.plugin(uniqueValidator)





module.exports = mongoose.model('Channel', channelSchema)