const mongoose = require('mongoose')


const counterSchema = new mongoose.Schema({
  name: String,
  count: Number
})


module.exports = mongoose.model('Counter', counterSchema)