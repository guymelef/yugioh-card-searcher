const mongoose = require('mongoose')
mongoose.set('strictQuery', true)
const tmi = require('tmi.js')
tmi.Client.prototype.reply = function(channel, replyMessage, replyParentMessageId) {
  return this.raw(`@reply-parent-msg-id=${replyParentMessageId} PRIVMSG ${channel} :${replyMessage}`)
}

const Channel = require('../models/channel')
const cardUtils = require('./card_util')
const botUtils = require('./bot_util')

let OPEN_CHANNELS
let client



const fetchDataAndSetupTmi = async () => { 
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Ⓜ️  Connected to MongoDB!')
    
    const channels = await Channel.find({}).select('name moderated -_id').lean().exec()
    botUtils.tmiOptions.channels = channels.map(channel => channel.name)
    console.log(`📃 ALL CHANNELS [${channels.length}]:`, channels.map(channel => channel.name).sort())
    OPEN_CHANNELS = channels.filter(channel => !channel.moderated).map(channel => channel.name)
    console.log(`🟩 All [${channels.length}] channels fetched!`)
    
    await cardUtils.fetchAllData()

    client = new tmi.client(botUtils.tmiOptions)
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

          if (!newChannel.moderated) OPEN_CHANNELS.push(response.name)

          await client.join(userChannel)
          console.log(`➡️ The bot joined ${userChannel}`, new Date().toLocaleString('en-ph'))
          return client.reply(
            channel,
            `Awesome! CardSearcher has joined your channel. 
            Don't forget to promote the bot to VIP or moderator.`,
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
        console.log(`⬅️  The bot left ${userChannel}`, new Date().toLocaleString('en-ph'))
        return client.reply(channel, `CardSearcher has successfully left your channel.`, tags.id)
      }
      
      if (message.startsWith("!channels")) {
        const userChannels = await Channel.find({}).sort({ name: 1 })
        let channelList = userChannels.filter(channel => channel.name !== '#cardsearcher')
        channelList = channelList.map(channel => `● ${channel.name.slice(1)}`)
        return client.say(
          channel,
          `imGlitch channel(s) using CardSearcher [${userChannels.length - 1}]: ${channelList.join(', ')}`
        )
      }
    }
    
    if (OPEN_CHANNELS.includes(channel) || tags.badges.broadcaster || tags.mod) {
      if (message.startsWith("!search")) {
        const messageArray = message.split(' ')
        const searchArg = messageArray[1]
        const query = messageArray.slice(2).join(' ')

        switch (searchArg) {
          case undefined:
            return client.reply(channel, "❓Usage: !search <full/partial card name>", tags.id)
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
            const card = cardUtils.getRandomCard()
            const cardInfo = botUtils.getCardInfo(card)
            return client.say(channel, cardInfo)
          case "--image":
            if (!query)
              return client.reply(channel, `❓Usage: !search --image <full/partial card name>`, tags.id)
            
            if (!cardUtils.normalizeString(query)) return
            
            console.log(`🚀 [${channel}] SEARCHING FOR: "${query}"...`)
            const cardToShow = await cardUtils.findClosestCard(query)
            
            if (!cardToShow.length) {
              console.log(`❎ Search Failed: "${query}" not found`)
              return client.reply(channel, `${botUtils.returnErrMsg()}`, tags.id)
            }

            if (cardToShow.length > 1) {
              const responseMessage = botUtils.getCardArray(cardToShow)
              if (responseMessage.length > 500)
                return client.reply(
                  channel,`
                  Your search yielded 【${cardToShow.length.toLocaleString()}】 total possible cards.`,
                  tags.id
                )
              else
                return client.reply(channel, botUtils.getCardArray(cardToShow), tags.id)
            }
            
            const link = await botUtils.transformToBitlyUrl(cardToShow[0].image)
            return client.reply(channel, `📸 "${cardToShow[0].name}" - [ ${link} ]`, tags.id)
          case "--list":
            if (!query) return client.reply(channel, `❓Usage (max 100 cards): !search --list <keyword>`, tags.id)
            
            if (!cardUtils.normalizeString(query)) return

            console.log(`🚀 [${channel}] GENERATING LIST FOR: "${query}"...`)
            const cardList = await cardUtils.findClosestCard(query, true)
            
            if (!cardList.length) {
              console.log(`❎ Search Failed: "${query}" not found`)
              return client.reply(channel, `${botUtils.returnErrMsg()}`, tags.id)
            }
  
            if (cardList.length > 100)
              return client.reply(
                channel,`
                Your search yielded 【${cardList.length.toLocaleString()}】 total possible cards.`,
                tags.id
              )
            
            const cardArray = botUtils.getCardArray(cardList)
            if (cardArray.length > 500)
              return client.say(channel, cardArray)
            else
              return client.reply(channel, cardArray, tags.id)
          default:
            const searchQuery = ORIGINAL_MESSAGE.split(' ').slice(1).join(' ')
            
            if (!cardUtils.normalizeString(searchQuery)) return

            console.log(`🚀 [${channel}] SEARCHING FOR: "${searchQuery}"...`)
            const searchResult = await cardUtils.findClosestCard(searchQuery)
      
            if (!searchResult.length) {
              console.log(`❎ Search Failed: "${searchQuery}" not found`)
              return client.reply(channel, `${botUtils.returnErrMsg()}`, tags.id)
            }
            
            if (searchResult.length > 1) {
              const responseMessage = botUtils.getCardArray(searchResult)
              if (responseMessage.length > 500) {
                const closestNatural = cardUtils.findClosestNatural(searchQuery, searchResult)
                
                return client.reply(
                  channel,
                  `Your search yielded ❮${searchResult.length.toLocaleString()}❯ total possible cards.
                  Looking for “${closestNatural[0].name}”? 🤔`,
                  tags.id
                )
              } else {
                return client.reply(channel, botUtils.getCardArray(searchResult), tags.id)
              }
            }
            
            const cardText = botUtils.getCardInfo(searchResult[0])
            if (cardText.length > 500)
              return client.say(channel, cardText)
            else
              return client.reply(channel, cardText, tags.id)
        }
      }
    }
  } catch (err) {
    console.log("🔴 MESSAGE HANDLER ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
    console.log("⚕️ INFO:", `[${channel}]: ${message}\n`, tags)
  }
}





module.exports = {
  fetchDataAndSetupTmi
}