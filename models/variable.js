const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')



const variableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  }
}, { strict: false })

variableSchema.plugin(uniqueValidator)





module.exports = mongoose.model('BotVariable', variableSchema)