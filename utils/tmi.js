const mongoose = require('mongoose')
const tmi = require('tmi.js')
const Redis = require('ioredis')

const {
  MONGODB_URI,
  REDIS_URI,
  REDIS_TTL,
  tmiOptions 
} = require('../config/config')
const {
  getCardInfo,
  getCardArray,
  transformToBitlyUrl,
} = require('./card')
const {
  fetchAllData,
  normalizeString,
  getRandomCard,
  findClosestCard,
  findClosestNaturalCard,
  searchYugipedia
} = require('./search')
const { returnErrorMessage } = require('./error')
const Channel = require('../models/channel')



let OPEN_CHANNELS
let client
let redis

const fetchDataAndSetupBot = async () => {
  try {
    mongoose.set('strictQuery', true)
    await mongoose.connect(MONGODB_URI)
    console.log('Ⓜ️ Connected to MongoDB!')
    const channels = await Channel.find({}).select('name moderated -_id').lean().exec()
    tmiOptions.channels = channels.map(channel => channel.name)
    console.log(`🟣 ALL CHANNELS [${channels.length}]:`, channels.map(channel => `${channel.name}${channel.moderated ? '*' : ''}`).sort())
    OPEN_CHANNELS = channels.filter(channel => !channel.moderated).map(channel => channel.name)

    await fetchAllData()

    // REDIS
    redis = new Redis(REDIS_URI)
    redis.on('connect', () => console.log("🧲 REDIS connection established"))

    // TMI
    tmi.Client.prototype.reply = function(channel, replyMessage, replyParentMessageId) {
      return this.raw(`@reply-parent-msg-id=${replyParentMessageId} PRIVMSG ${channel} :${replyMessage}`)
    }
    client = new tmi.client(tmiOptions)
    client.setMaxListeners(100)
    client.connect()
    client.on('message', onMessageHandler)
    client.on('connected', (server, port) => console.log(`🤖 TMI connected to ${server}:${port}`))
  } catch (err) {
    console.log("🟥 BOT SET UP ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const onMessageHandler = async (channel, tags, message, self) => {
  let ORIGINAL_MESSAGE = ''
  let userChannel = ''

  try {
    if (self) return

    ORIGINAL_MESSAGE = message
    userChannel = `#${tags.username}`
    message = message.toLowerCase()

    if (channel === "#cardsearcher") {
      if (message.startsWith("!join")) {
        const messageArray = message.split(' ')
        
        if (!["close", "open"].includes(messageArray[1]))
          return client.reply(channel, `❓Usage: !join <open|close>`, tags.id)
        
        const channelToJoin = await Channel.findOne({ name: userChannel })
        if (!channelToJoin) {
          const newChannel = await new Channel({
            name: userChannel,
            moderated: messageArray[1] === "close"
          }).save()

          if (!newChannel.moderated) OPEN_CHANNELS.push(newChannel.name)

          await client.join(userChannel)
          console.log(`🧩 THE BOT JOINED [ ${userChannel} ]`, new Date().toLocaleString('en-ph'))
          return client.reply(
            channel,
            `Awesome! CardSearcher has joined your channel. Don't forget to promote the bot to VIP/moderator.`,
            tags.id
          )
        } else {
          const channelToUpdate = await Channel.findOneAndUpdate(
            { name: userChannel },
            { moderated: messageArray[1] === "close", updated: Date.now() },
            { new: true }
          )

          if (!channelToUpdate.moderated)
            if (!OPEN_CHANNELS.includes(channelToUpdate.name)) OPEN_CHANNELS.push(channelToUpdate.name)
          else
            OPEN_CHANNELS = OPEN_CHANNELS.filter(channel => channel !== channelToUpdate.name)

          return client.reply(
            channel,
            `Your bot setting is now set to "${messageArray[1].toUpperCase()}".`,
            tags.id
          )
        }
      }
      
      if (message.startsWith("!part")) {
        const channelToLeave = await Channel.findOneAndDelete({ name: userChannel })
        
        if (!channelToLeave)
          return client.reply(
            channel,
            `CardSearcher hasn't joined your channel yet. ❓Usage: !join <open|close>`,
            tags.id
          )
        
        await client.part(userChannel)
        OPEN_CHANNELS = OPEN_CHANNELS.filter(channel => channel !== userChannel)
        console.log(`💔 THE BOT LEFT [ ${userChannel} ]`, new Date().toLocaleString('en-ph'))
        return client.reply(channel, `CardSearcher has successfully left your channel.`, tags.id)
      }

      if (message.startsWith("!channels")) {
        let twitchChannels = await Channel.find({}).sort({ name: 1 })
        twitchChannels = twitchChannels.filter(channel => channel.name !== '#cardsearcher')
        twitchChannels = twitchChannels.map(channel => `● ${channel.name.slice(1)}`)
        return client.say(
          channel,
          `imGlitch channel(s) using CardSearcher [${twitchChannels.length}]: ${twitchChannels.join(', ')}`
        )
      }
    }

    if (OPEN_CHANNELS.includes(channel) || tags.badges?.broadcaster || tags.mod) {
      if (message.startsWith("!search")) {
        const messageArray = message.split(' ')
        let searchType = messageArray[1]
        let query = ORIGINAL_MESSAGE.split(' ').slice(2).join(' ')
        const noCache = message.startsWith("!search*") || message.startsWith("!searchr*")
        const rushSearch = message.startsWith("!searchr")
        const cardPool = rushSearch ? 'rush' : 'main'
        let searchPrefix = rushSearch ? 'searchr' : 'search'
        let messagePrefix = rushSearch ? '🚀' : '🎴'
        const searchCategory = cardPool === 'main' ? '🟩' : '🟧'
        let searchResult = []
        let responseMessage = ''
        let redisKey = ''
        let redisValue = ''

        const checkRedisAndReply = async () => {
          const userQuery = query
          query = normalizeString(query)
          if (!query) return client.reply(channel, returnErrorMessage(), tags.id)

          const getRedisValue = async () => {
            try {
              return await redis.get(redisKey)
            } catch (err) {
              console.log("🟥 REDIS GET ERROR:", err)
              return null
            }
          }

          const setRedisValue = async () => {
            try {
              await redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
            } catch (err) {
              console.log("🟥 REDIS SET ERROR:", err)
            }
          }

          const returnResponseForLongSearchResult = () => {
            const suggestion = cardPool === 'main' ?
              `For «RUSH DUEL» cards, type: !searchR <keyword>【 More commands @ https://twitch.tv/cardsearcher/about 】`
              : `For anime or non-TCG/OCG cards, try a Yugipedia lookup with: !search --wiki <card name>【 More commands @ https://twitch.tv/cardsearcher/about 】`
            const closestNatural = findClosestNaturalCard(userQuery, searchResult)
            const message = `🔎 Your search yielded ❮${searchResult.length.toLocaleString()}❯ total possible cards. Looking for “${closestNatural}”? ${suggestion}`

            redisValue = JSON.stringify({ short: true, result: message })
            setRedisValue()
            return client.reply(channel, message, tags.id)
          }

          if (searchType === 'wiki') searchPrefix = 'search'
          redisKey = `${searchPrefix}${searchType}:${query}`
          redisValue = await getRedisValue()
          if (redisValue && !noCache) {
            console.log('🔑 REDIS CACHE FOUND!')
            redisValue = JSON.parse(redisValue)

            if (!redisValue.result.length) return client.reply(channel, returnErrorMessage(), tags.id)

            if (redisValue.short) return client.reply(channel, redisValue.result, tags.id)
            else return client.say(channel, redisValue.result)
          } else {
            if (searchType === 'wiki') {
              searchResult = await searchYugipedia(userQuery)
              if (!searchResult) return
            } else {
              searchResult = await findClosestCard(userQuery, searchType === 'list', cardPool)
            }
            
            if (!searchResult.length) {
              redisValue = JSON.stringify({ short: true, result: [] })
              setRedisValue()
              return client.reply(channel, returnErrorMessage(), tags.id)
            }

            if (searchResult.length === 1) {
              if (searchType === 'image') {
                const link = await transformToBitlyUrl(searchResult[0].image)
                responseMessage = `📸 "${searchResult[0].name}" - [ ${link} ]`
              } else if (searchType === 'list') {
                responseMessage = getCardArray(searchResult)
              } else {
                const card = searchResult[0]
                messagePrefix = (rushSearch || card.category === 'rush') ? '🚀' : '🎴'
                responseMessage = `${messagePrefix} ${getCardInfo(card)}`
              }

              const isShort = responseMessage.length <= 500
              redisValue = JSON.stringify({ short: isShort, result: responseMessage })
              setRedisValue()

              if (isShort) return client.reply(channel, responseMessage, tags.id)
              else return client.say(channel, responseMessage)
            }

            if (searchType === 'list') {
              if (searchResult.length <= 100) {
                responseMessage = getCardArray(searchResult)
                redisValue = JSON.stringify({ short: false, result: responseMessage })
                setRedisValue()
                return client.say(channel, responseMessage)
              } else {
                return returnResponseForLongSearchResult()
              }
            }

            if (searchResult.length > 30) {
              return returnResponseForLongSearchResult()
            } else {
              responseMessage = getCardArray(searchResult)
              if (responseMessage.length > 500) {
                return returnResponseForLongSearchResult()
              } else {
                redisValue = JSON.stringify({ short: true, result: responseMessage })
                setRedisValue()
                return client.reply(channel, responseMessage, tags.id)
              }
            }
          }
        }

        if (!searchType) {
          if (noCache)
            return client.reply(channel, `❓Usage (non-cached): !${searchPrefix}* <keyword>`, tags.id)
          else if (rushSearch)
            return client.reply(channel, `❓Usage (Rush Duel): !searchr <keyword>`, tags.id)
          else
            return client.reply(channel, `❓Usage: !search <keyword>`, tags.id)
        } else if (['--image', '--list', '--wiki'].includes(searchType) && !query) {
          if (searchType === '--wiki')
            return client.reply(channel, `❓Usage${noCache ? ' (non-cached)' : ''}: !search${noCache ? '*' : ''} --wiki <keyword>`, tags.id)
          else if (noCache)
            return client.reply(channel, `❓Usage (non-cached): !${searchPrefix}* ${searchType} <keyword>`, tags.id)
          else if (rushSearch)
            return client.reply(channel, `❓Usage (Rush Duel): !searchr ${searchType} <keyword>`, tags.id)
          else
            return client.reply(channel, `❓Usage: !search ${searchType} <keyword>`, tags.id)
        }

        switch (searchType) {
          case "--guide":
            return client.reply(
              channel,
              `MONSTER: [ 🟡: Normal, 🟠: Effect, 🟤: Tuner, 🔵: Ritual, 🟣: Fusion, ⚪: Synchro, ⚫: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token ], 🟢: SPELL, 🔴: TRAP, ✨: SKILL`,
              tags.id
            )
          case "--random":
            console.log(`${searchCategory} [${userChannel} @ ${channel}]: 🔀 fetching...`)
            searchResult = getRandomCard(cardPool)
            return client.say(channel, `${messagePrefix} ${getCardInfo(searchResult)}`)
          case "--image":
            console.log(`${searchCategory} [${userChannel} @ ${channel}]: 📸 "${query}"`)
            searchType = 'image'
            return checkRedisAndReply()
          case "--list":
            console.log(`${searchCategory} [${userChannel} @ ${channel}]: 📜 "${query}"`)
            searchType = 'list'
            return checkRedisAndReply()
          case "--wiki":
            console.log(`${searchCategory} [${userChannel} @ ${channel}]: 🌐 "${query}"`)
            searchType = 'wiki'
            return checkRedisAndReply()
          default:
            query = ORIGINAL_MESSAGE.split(' ').slice(1).join(' ')
            console.log(`${searchCategory} [${userChannel} @ ${channel}]: 🔎 "${query}"`)
            searchType = ''
            return checkRedisAndReply()
        }
      }
    }
  } catch (err) {
    console.log("🟥 MESSAGE HANDLER ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
    console.log("⚕️ INFO:", `[${userChannel} @ ${channel}]: ${ORIGINAL_MESSAGE}\n`, tags)

    if (channel === "#cardsearcher") client.reply(channel, `❗Oops, an error occured! Please try again or report the problem.`, tags.id)
    else return
  }
}





module.exports = {
  fetchDataAndSetupBot
}