const express = require('express')
const cors = require('cors')
const Redis = require('ioredis')

const { fetchDataAndSetupBot } = require('./utils/tmi')
const { fetchAllData } = require('./utils/search')
const { checkRequestKeyHeader } = require('./middleware/middleware')
const { REDIS_URI, PORT } = require('./config/config')



// INITIALIZE TWITCH BOT
fetchDataAndSetupBot()

// SET UP EXPRESS SERVER
const app = express()
app.use(cors())
app.use(checkRequestKeyHeader)

app.get("/refresh_data", (_, res) => {
  console.log('\n🕊️ RE-FETCHING BOT DATA...')
  
  fetchAllData()
    .then(_ => {
      console.log("🐳 BOT DATA REFRESHED!")
      res.json({
        message: "bot data refresh success",
        date: new Date().toLocaleString('en-ph')
      })
    })
    .catch(err => {
      console.error("🟥 FETCH DATA ERROR:", err.message)
      res.json({ error: err.message })
    })
})

app.get("/flush_cache", (_, res) => {
  console.log('\n🗑️ FLUSHING REDIS CACHE...')

  const redis = new Redis(REDIS_URI)
  redis.on('connect', () => {
    console.log("🧲 REDIS connection established")
    
    redis.flushall()
      .then(_ => {
        console.log('🌳 REDIS CACHE EMPTIED!')
        res.json({
          message: "redis cache reset success",
          date: new Date().toLocaleString('en-ph')
        })
        redis.quit()
      })
      .catch(err => {
        console.error("🟥 REDIS FLUSH ERROR:", err.message)
        res.json({ error: err.message })
      })
  })
})

app.listen(PORT, () => console.log(`🐶 THE SERVER IS UP!`))