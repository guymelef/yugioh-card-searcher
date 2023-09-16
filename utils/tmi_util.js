const mongoose = require('mongoose')
mongoose.set('strictQuery', true)
const tmi = require('tmi.js')
tmi.Client.prototype.reply = function(channel, replyMessage, replyParentMessageId) {
  return this.raw(`@reply-parent-msg-id=${replyParentMessageId} PRIVMSG ${channel} :${replyMessage}`)
}
const { createClient } = require('redis')

const Channel = require('../models/channel')
const {
  fetchAllData,
  normalizeString,
  getRandomCard,
  findClosestCard,
  findClosestNaturalCard,
  searchYugipedia
} = require('./card_util')
const {
  tmiOptions,
  getCardInfo,
  getCardArray,
  transformToBitlyUrl,
  returnErrMsg,
} = require('./bot_util')
const { MONGODB_URI, REDIS_URI, REDIS_TTL } = require('./config')

let OPEN_CHANNELS
let client
let redis



const fetchDataAndSetupBot = async () => { 
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Ⓜ️  Connected to MongoDB!')
    
    const channels = await Channel.find({}).select('name moderated -_id').lean().exec()
    tmiOptions.channels = channels.map(channel => channel.name)
    console.log(`📃 ALL CHANNELS [${channels.length}]:`, channels.map(channel => channel.name).sort())
    OPEN_CHANNELS = channels.filter(channel => !channel.moderated).map(channel => channel.name)
    console.log(`🟩 All [${channels.length}] channels fetched!`)
    
    await fetchAllData()

    // TMI
    client = new tmi.client(tmiOptions)
    client.setMaxListeners(100)
    client.connect()
    client.on('message', onMessageHandler)
    client.on('connected', (server, port) => console.log(`🆗 TMI is connected to ${server}:${port}`))

    // REDIS
    redis = createClient({ url: REDIS_URI })
    redis.connect()
    redis.on('ready', () => console.log("🔥 REDIS is ready!"))
    redis.on('error', (err) => console.log("⚠️ REDIS ERROR:", err))
  } catch (err) {
    console.log("🔴 DATA SET UP ERROR:", err.message)
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
          console.log(`➕ THE BOT JOINED [ ${userChannel} ]`, new Date().toLocaleString('en-ph'))
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
        console.log(`➖ THE BOT LEFT [ ${userChannel} ]`, new Date().toLocaleString('en-ph'))
        return client.reply(channel, `CardSearcher has successfully left your channel.`, tags.id)
      }
      
      if (message.startsWith("!channels")) {
        const userChannels = await Channel.find({}).sort({ name: 1 })
        let channelList = userChannels.filter(channel => channel.name !== '#cardsearcher')
        channelList = channelList.map(channel => `● ${channel.name.slice(1)}`)
        return client.say(
          channel,
          `imGlitch channel(s) using CardSearcher [${channelList.length}]: ${channelList.join(', ')}`
        )
      }
    }
    
    if (OPEN_CHANNELS.includes(channel) || tags.badges.broadcaster || tags.mod) {
      if (message.startsWith("!search")) {
        const messageArray = message.split(' ')
        let searchType = messageArray[1]
        let query = ORIGINAL_MESSAGE.split(' ').slice(2).join(' ')
        let userQuery = ''
        let searchResult = []
        let responseMessage = ''
        let redisKey = ''
        let redisValue = ''
        const noCache = message.startsWith("!search*")

        const returnResponseForLongSearchResult = () => {
          const emoji = ['🤔', '🧐', '🤨'][Math.floor(Math.random() * 3)]
          const closestNatural = findClosestNaturalCard(userQuery, searchResult)
          return `Your search yielded ❮${searchResult.length.toLocaleString()}❯ total possible cards. Looking for “${closestNatural}”? ${emoji}`
        }

        const checkRedisAndReply = async () => {
          userQuery = query
          query = normalizeString(query)
          if (!query) return client.reply(channel, returnErrMsg(), tags.id)

          redisKey = `search${searchType}:${query}`
          redisValue = await redis.get(redisKey)

          if (redisValue && !noCache) {
            console.log('💯 REDIS CACHE FOUND!')
            redisValue = JSON.parse(redisValue)

            if (!redisValue.result.length) return client.reply(channel, returnErrMsg(), tags.id)

            if (redisValue.short) return client.reply(channel, redisValue.result, tags.id)
            else return client.say(channel, redisValue.result)
          } else {
            if (searchType === 'wiki') {
              searchResult = await searchYugipedia(userQuery)
              
              if (!searchResult) return ''

              if (!searchResult.length) {
                redisValue = JSON.stringify({ short: true, result: [] })
                redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
                return client.reply(channel, returnErrMsg(), tags.id)
              }
            } else {
              searchResult = await findClosestCard(query, searchType === 'list')
            }
            
            if (searchResult.length === 1) {
              if (searchType === 'image') {
                const link = await transformToBitlyUrl(searchResult[0].image)
                responseMessage = `📸 "${searchResult[0].name}" - [ ${link} ]`
              } else if (searchType === 'list') {
                responseMessage = getCardArray(searchResult)
              } else {
                responseMessage = getCardInfo(searchResult[0])
              }

              const isShort = responseMessage.length <= 500
              redisValue = JSON.stringify({ short: isShort, result: responseMessage })
              redis.set(redisKey, redisValue, 'EX', REDIS_TTL)

              if (isShort) return client.reply(channel, responseMessage, tags.id)
              else return client.say(channel, responseMessage)
            }

            if (searchType === 'list') {
              if (searchResult.length <= 100) {
                responseMessage = getCardArray(searchResult)
                redisValue = JSON.stringify({ short: false, result: responseMessage })
                redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
                return client.say(channel, responseMessage)
              } else {
                responseMessage = returnResponseForLongSearchResult()
                redisValue = JSON.stringify({ short: true, result: responseMessage })
                redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
                return client.reply(channel, responseMessage, tags.id)
              }
            }

            if (searchResult.length > 30) {
              responseMessage = returnResponseForLongSearchResult()
              redisValue = JSON.stringify({ short: true, result: responseMessage })
              redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
              return client.reply(channel, responseMessage, tags.id)
            } else {
              responseMessage = getCardArray(searchResult)
              if (responseMessage.length > 500) {
                responseMessage = returnResponseForLongSearchResult()
                redisValue = JSON.stringify({ short: true, result: responseMessage })
                redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
                return client.reply(channel, responseMessage, tags.id)
              } else {
                redisValue = JSON.stringify({ short: true, result: responseMessage })
                redis.set(redisKey, redisValue, 'EX', REDIS_TTL)
                return client.reply(channel, responseMessage, tags.id)
              }
            }
          }
        }

        switch (searchType) {
          case undefined:
            if (noCache) return client.reply(channel, "❓Usage (non-cached): !search* <keyword>", tags.id)
            else return client.reply(channel, "❓Usage: !search <keyword>", tags.id)
          case "--guide":
            return client.reply(
              channel,
              `MONSTER: [ 🟡: Normal, 🟠: Effect, 🟤: Tuner, 🔵: Ritual, 🟣: Fusion, ⚪: Synchro, ⚫: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token ], 🟢: SPELL, 🔴: TRAP, ✨: SKILL`,
              tags.id
            )
          case "--random":
            searchResult = getRandomCard()
            return client.say(channel, getCardInfo(searchResult))
          case "--image":
            if (!query) {
              if (noCache) return client.reply(channel, "❓Usage (non-cached): !search* --image <card name>", tags.id)
              else return client.reply(channel, `❓Usage: !search --image <card name>`, tags.id)
            }

            console.log(`🚀 [${channel}] SEARCHING CARD IMAGE FOR: "${query}"...`)
            searchType = 'image'
            return checkRedisAndReply()
          case "--list":
            if (!query) {
              if (noCache) return client.reply(channel, "❓Usage (non-cached): !search* --list <keyword>", tags.id)
              else return client.reply(channel, `❓Usage: !search --list <keyword>`, tags.id)
            }

            console.log(`🚀 [${channel}] GENERATING LIST FOR: "${query}"...`)
            searchType = 'list'
            return checkRedisAndReply()
          case "--wiki":
            if (!query) {
              if (noCache) return client.reply(channel, `❓Usage (non-cached): !search* --wiki <keyword>`, tags.id)
              else return client.reply(channel, `❓Usage: !search --wiki <keyword>`, tags.id)
            }

            console.log(`🚀 [${channel}] SEARCHING [YUGIPEDIA] FOR: "${query}"...`)
            searchType = 'wiki'
            return checkRedisAndReply()
          default:
            query = ORIGINAL_MESSAGE.split(' ').slice(1).join(' ')

            console.log(`🚀 [${channel}] SEARCHING FOR: "${query}"...`)
            searchType = ''
            return checkRedisAndReply()
        }
      }
    }
  } catch (err) {
    if (channel === "#cardsearcher") client.reply(channel, `Oops, an error occured! Please try again or report the problem.`, tags.id)
    else client.reply(channel, returnErrMsg(), tags.id)
    
    console.log("🔴 MESSAGE HANDLER ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
    console.log("⚕️ INFO:", `[${userChannel} @ ${channel}]: ${ORIGINAL_MESSAGE}\n`, tags)
  }
}





module.exports = {
  fetchDataAndSetupBot
}