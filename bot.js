require('dotenv').config()
const express = require('express')
const app = express()

const cardUtils = require('./utils/card_util')
const { fetchDataAndSetupTmi } = require('./utils/tmi_util')



// FETCH DATA & SETUP TMI
fetchDataAndSetupTmi()


// EXPRESS SERVER
app.get("/", (_, res) => {
  const twitch = '<h1><a href="https://twitch.tv/cardsearcher">CardSearcher</a></h1>'
  res.setHeader('Content-Type', 'text/html')
  res.send(twitch)
})

app.get("/update/:src", (req, res) => {
  const source = req.params.src

  if (source === 'ygopd') {
    console.log(`\n🌐 CHECKING YGOPD...`)
    cardUtils.checkForNewYgopdCards()
    .then(_ => console.log("✔️  DB CHECK COMPLETE!\n"))
    .catch(err => console.log("ERROR:", err))
  }

  if (source === 'yugipedia') {
    console.log(`\n🌏 CHECKING YUGIPEDIA...`)
    cardUtils.checkForNewYugipediaCards()
    .then(_ => console.log("✔️  DB CHECK COMPLETE!\n"))
    .catch(err => console.log("ERROR:", err))
  }

  res.json({
    message: "database update initiated",
    source,
    date: new Date().toLocaleString('en-ph')
  })
})

app.get("/refresh_data", (_, res) => {
  console.log(`\n💧 RE-FETCHING BOT DATA...`)
  cardUtils.fetchAllData()
  .then(_ => console.log("🔃  BOT DATA REFRESH SUCCESS!\n"))
  .catch(err => console.log("ERROR:", err))

  res.json({
    message: "bot data refresh initiated",
    date: new Date().toLocaleString('en-ph')
  })
})

app.listen(process.env.PORT, () => console.log(`🐶 THE SERVER IS UP!`))