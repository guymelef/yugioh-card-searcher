const returnErrorMessage = () => {
  const errorMessages = require('../data/error-messages.json')

  const index = Math.floor(Math.random() * errorMessages.length)
  return `${errorMessages[index]} 💀`
}





module.exports = { returnErrorMessage }