const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')


const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  },
  desc: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  },
  characters: [ {name: String, how: String} ]
}, { collation: { locale: 'en', strength: 2 } })

skillSchema.plugin(uniqueValidator)



module.exports = mongoose.model('Skill', skillSchema)