const express = require('express')
const cors = require('cors')

const { fetchAllData } = require('./utils/card_util')
const { fetchDataAndSetupBot, redis } = require('./utils/tmi_util')
const { checkRequestKeyHeader } = require('./utils/middleware')
const { PORT } = require('./utils/config')



// FETCH DATA & SETUP BOT
fetchDataAndSetupBot()

// EXPRESS SERVER
const app = express()
app.use(cors())
app.use(checkRequestKeyHeader)
app.use(express.json())

app.get("/refresh_data", (_, res) => {
  console.log('\n🕊️ RE-FETCHING BOT DATA...')
  
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

app.get("/flush_cache", (_, res) => {
  console.log('\n🧹 FLUSHING REDIS CACHE...')

  redis.flushall()
    .then(_ => {
      console.log('🗑️ REDIS CACHE EMPTIED!\n')
      res.json({
        message: "redis cache reset success",
        date: new Date().toLocaleString('en-ph')
      })
    })
    .catch(err => {
      console.error("🔴 REDIS FLUSH ERROR:", err.message)
      res.json({ message: 'redis cache reset failed', error: err.message })
    })
})


app.listen(PORT, () => console.log(`🐶 THE SERVER IS UP!`))