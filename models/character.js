const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')


const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  },
  season: {
    type: String,
    required: true,
  }
}, { collation: { locale: 'en', strength: 2 } })

characterSchema.plugin(uniqueValidator)



module.exports = mongoose.model('Character', characterSchema)