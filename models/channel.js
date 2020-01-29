const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')


const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  moderated: {
    type: Boolean
  }
})

channelSchema.plugin(uniqueValidator)


module.exports = mongoose.model('Channel', channelSchema)