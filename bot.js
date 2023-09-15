require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())

const { fetchAllData } = require('./utils/card_util')
const { fetchDataAndSetupBot } = require('./utils/tmi_util')



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