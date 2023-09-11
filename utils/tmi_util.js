const mongoose = require('mongoose')
mongoose.set('strictQuery', true)
const tmi = require('tmi.js')
tmi.Client.prototype.reply = function(channel, replyMessage, replyParentMessageId) {
  return this.raw(`@reply-parent-msg-id=${replyParentMessageId} PRIVMSG ${channel} :${replyMessage}`)
}

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

let OPEN_CHANNELS
let client



const fetchDataAndSetupTmi = async () => { 
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Ⓜ️  Connected to MongoDB!')
    
    const channels = await Channel.find({}).select('name moderated -_id').lean().exec()
    tmiOptions.channels = channels.map(channel => channel.name)
    console.log(`📃 ALL CHANNELS [${channels.length}]:`, channels.map(channel => channel.name).sort())
    OPEN_CHANNELS = channels.filter(channel => !channel.moderated).map(channel => channel.name)
    console.log(`🟩 All [${channels.length}] channels fetched!`)
    
    await fetchAllData()

    client = new tmi.client(tmiOptions)
    client.setMaxListeners(100)
    client.connect()
    client.on('message', onMessageHandler)
    client.on('connected', (server, port) => console.log(`🆗 Connected to ${server}:${port}`))
  } catch (err) {
    console.log("🔴 DATA SET UP ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const onMessageHandler = async (channel, tags, message, self) => {
  try {
    if (self) return
    
    const ORIGINAL_MESSAGE = message
    const userChannel = `#${tags.username}`
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
        const searchArg = messageArray[1]
        let query = messageArray.slice(2).join(' ')
        let searchResult = []
        let responseMessage = ''

        const returnResponseForLongSearchResult = () => {
          const closestNatural = findClosestNaturalCard(query, searchResult)
          return client.reply(
            channel,
            `Your search yielded ❮${searchResult.length.toLocaleString()}❯ total possible cards. Looking for “${closestNatural}”? 🤔`,
            tags.id
          )
        }

        switch (searchArg) {
          case undefined:
            return client.reply(channel, "❓Usage: !search <keyword>", tags.id)
          case "--guide":
            return client.reply(
              channel,
              `MONSTER: [
                🟡: Normal, 🟠: Effect, 🟤: Tuner, 🔵: Ritual, 🟣: Fusion, 
                ⚪: Synchro, ⚫: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token
              ], 
              🟢: SPELL, 🔴: TRAP, ✨: SKILL`,
              tags.id
            )
          case "--random":
            searchResult = getRandomCard()
            return client.say(channel, getCardInfo(searchResult))
          case "--image":
            if (!query) return client.reply(channel, `❓Usage: !search --image <card name>`, tags.id)
            if (!normalizeString(query)) return client.reply(channel, returnErrMsg(), tags.id)
            
            console.log(`🚀 [${channel}] SEARCHING IMAGE FOR: "${query}"...`)
            searchResult = await findClosestCard(query)
            if (searchResult.length > 1) {
              responseMessage = getCardArray(searchResult)
              if (responseMessage.length > 500) return returnResponseForLongSearchResult()
              else return client.reply(channel, getCardArray(searchResult), tags.id)
            }
            
            const link = await transformToBitlyUrl(searchResult[0].image)
            return client.reply(channel, `📸 "${searchResult[0].name}" - [ ${link} ]`, tags.id)
          case "--list":
            if (!query) return client.reply(channel, `❓Usage: !search --list <keyword>`, tags.id)
            if (!normalizeString(query)) return client.reply(channel, returnErrMsg(), tags.id)

            console.log(`🚀 [${channel}] GENERATING LIST FOR: "${query}"...`)
            searchResult = await findClosestCard(query, true)
            if (searchResult.length > 100) return returnResponseForLongSearchResult()
            
            const cardArrayString = getCardArray(searchResult)
            if (cardArrayString.length > 500) return client.say(channel, cardArrayString)
            else return client.reply(channel, cardArrayString, tags.id)
          case "--wiki":
            if (!query) return client.reply(channel, `❓Usage: !search --wiki <keyword>`, tags.id)
            if (!normalizeString(query)) return client.reply(channel, returnErrMsg(), tags.id)

            console.log(`🚀 [${channel}] SEARCHING [YUGIPEDIA] FOR: "${query}"...`)
            searchResult = await searchYugipedia(query)
            if (!searchResult) return ''
            if (searchResult.length) return client.say(channel, getCardInfo(searchResult[0]))
            else return client.reply(channel, returnErrMsg(), tags.id)
          default:
            query = ORIGINAL_MESSAGE.split(' ').slice(1).join(' ')
            if (!normalizeString(query)) return client.reply(channel, returnErrMsg(), tags.id)

            console.log(`🚀 [${channel}] SEARCHING FOR: "${query}"...`)
            searchResult = await findClosestCard(query)
            if (searchResult.length > 1) {
              responseMessage = getCardArray(searchResult)
              if (responseMessage.length > 500) return returnResponseForLongSearchResult()
              else return client.reply(channel, getCardArray(searchResult), tags.id)
            }
            
            const cardText = getCardInfo(searchResult[0])
            if (cardText.length > 500) return client.say(channel, cardText)
            else return client.reply(channel, cardText, tags.id)
        }
      }
    }
  } catch (err) {
    if (channel === "#cardsearcher") client.reply(channel, `Oops, an error occured! Please try again or report the problem.`, tags.id)
    else client.reply(channel, returnErrMsg(), tags.id)
    
    console.log("🔴 MESSAGE HANDLER ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
    console.log("⚕️ INFO:", `[${channel}]: ${message}\n`, tags)
  }
}





module.exports = {
  fetchDataAndSetupTmi
}