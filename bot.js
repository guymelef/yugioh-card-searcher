const express = require('express')
const cors = require('cors')
const app = express()

const { fetchAllData } = require('./utils/card_util')
const { fetchDataAndSetupBot } = require('./utils/tmi_util')
const { checkRequestKeyHeader } = require('./utils/middleware')
const { PORT } = require('./utils/config')



// FETCH DATA & SETUP BOT
fetchDataAndSetupBot()

// EXPRESS SERVER
app.use(cors())
app.use(checkRequestKeyHeader)

app.get("/refresh_data", (_, res) => {
  console.log(`\n🕊️ RE-FETCHING BOT DATA...`)
  
  fetchAllData()
    .then(_ => {
      console.log("🐳 BOT DATA REFRESHED!\n")
      res.json({
        message: "bot data refresh success",
        date: new Date().toLocaleString('en-ph')
      })
    })
    .catch(err => {
      console.log("❌ FETCH DATA ERROR:", err.message)
      res.json({ message: 'bot data refresh failed', error: err.message })
    })
})

app.listen(PORT, () => console.log(`🐶 THE SERVER IS UP!`))