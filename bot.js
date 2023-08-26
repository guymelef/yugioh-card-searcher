require('dotenv').config()
const express = require('express')
const app = express()

const cardUtils = require('./utils/card_util')
const { fetchDataAndSetupTmi } = require('./utils/tmi_util')



// FETCH DATA & SETUP TMI
fetchDataAndSetupTmi()


// EXPRESS SERVER
app.get("/", (_, response) => {
  const twitch = '<h1><a href="https://twitch.tv/cardsearcher">CardSearcher</a></h1>'
  response.setHeader('Content-Type', 'text/html')
  response.send(twitch)
})

app.get("/update", (_, response) => {
  cardUtils.updateCards()
  .then(_ => console.log("✔️  DB CHECK COMPLETE!"))
  .catch(err => console.log("ERROR:", err))
  
  response.json({
    message: "database update started",
    date: new Date().toLocaleString('en-ph')
  })
})

app.listen(process.env.PORT, () => console.log(`🐶 THE SERVER IS UP!`))