require('dotenv').config()



const PORT = process.env.PORT
const DEBUG = process.env.DEBUG
const BOT_USERNAME = process.env.BOT_USERNAME
const BOT_USER_AGENT = process.env.BOT_USER_AGENT
const OAUTH_TOKEN = process.env.OAUTH_TOKEN
const BITLY_GUID = process.env.BITLY_GUID
const BITLY_TOKEN = process.env.BITLY_TOKEN
const BITLY_API = process.env.BITLY_API
const SECRET_KEY = process.env.SECRET_KEY
const MONGODB_URI = process.env.MONGODB_URI
const REDIS_URI = process.env.REDIS_URI
const REDIS_TTL = process.env.REDIS_TTL
const SEARCHER_API = process.env.SEARCHER_API
const YUGIPEDIA_SEARCH = process.env.YUGIPEDIA_SEARCH
const YUGIPEDIA_PAGEID = process.env.YUGIPEDIA_PAGEID
const YUGIPEDIA_IMG = process.env.YUGIPEDIA_IMG

const tmiOptions = {
  options: { debug: DEBUG === "true" },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: BOT_USERNAME,
    password: OAUTH_TOKEN
  }
}

const requestOptions = {
  headers: { "User-Agent": `${BOT_USER_AGENT}` },
  redirect: 'follow'
}

const searchOptions = {
  method: 'POST',
  headers: {
    "Content-Type" : "application/json",
    "X-Request-Key": SECRET_KEY
  }
}





module.exports = {
  PORT,
  DEBUG,
  BOT_USERNAME,
  OAUTH_TOKEN,
  BOT_USER_AGENT,
  BITLY_GUID,
  BITLY_TOKEN,
  BITLY_API,
  SECRET_KEY,
  MONGODB_URI,
  REDIS_URI,
  REDIS_TTL,
  SEARCHER_API,
  YUGIPEDIA_SEARCH,
  YUGIPEDIA_PAGEID,
  YUGIPEDIA_IMG,
  tmiOptions,
  requestOptions,
  searchOptions
}