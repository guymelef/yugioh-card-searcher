require('dotenv').config()
const express = require('express')
const app = express()

const {
  checkForNewYgopdCards,
  checkForNewYugipediaCards,
  fetchAllData
} = require('./utils/card_util')
const { fetchDataAndSetupBot } = require('./tmi_util_test')



// FETCH DATA & SETUP BOT
fetchDataAndSetupBot()


// EXPRESS SERVER
app.get("/", (_, res) => {
  const twitch = `
    <h1>
      <a href="https://twitch.tv/cardsearcher">
        CardSearcher
      </a>
    </h1>
  `
  res.setHeader('Content-Type', 'text/html')
  res.send(twitch)
})

app.get("/update/:src", (req, res) => {
  const source = req.params.src
  const sources = { "ygopd":  checkForNewYgopdCards, "yugipedia": checkForNewYugipediaCards}

  console.log(`\n🌐 CHECKING [${source.toUpperCase()}]...`)
  sources[source]()
  .then(_ => console.log("✔️  DB CHECK COMPLETE!\n"))
  .catch(err => console.log("ERROR:", err))

  res.json({
    message: "database update initiated",
    source,
    date: new Date().toLocaleString('en-ph')
  })
})

app.get("/refresh_data", (_, res) => {
  console.log(`\n💧 RE-FETCHING BOT DATA...`)
  fetchAllData()
  .then(_ => console.log("🔃  BOT DATA REFRESHED!\n"))
  .catch(err => console.log("ERROR:", err))

  res.json({
    message: "bot data refresh initiated",
    date: new Date().toLocaleString('en-ph')
  })
})

app.listen(process.env.PORT, () => console.log(`🐶 THE SERVER IS UP!`))