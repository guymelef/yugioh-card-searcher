require('dotenv').config()
const mongoose = require('mongoose')
const express = require('express')
const app = express()
const tmi = require('tmi.js')

const Channel = require('./models/channel')
const botUtils = require('./utils/bot_util')
const cardUtils = require('./utils/card_util')

let unmoderatedChannels = []



// EXPRESS SERVER
app.get("/", (_, response) => response.send("https://www.twitch.tv/cardsearcher"))

app.get("/update", (_, response) => {
  cardUtils.updateCards()
  .then(_ => console.log("✔️  DB CHECK COMPLETE!"))
  .catch(err => console.log("ERROR:", err))
  
  response.json({ message: "updating database now" })
})

app.listen(process.env.PORT, () => console.log(`🐶 THE SERVER IS UP!`))


// CONNECT TO MONGOOSE & START TMI CLIENT
let client
console.log("▶️  Connecting to MongoDB...")
mongoose
.connect(process.env.MONGODB_URI)
.then(_ => { 
  console.log("Ⓜ️  Connected to MongoDB!")

  Channel
  .find({})
  .then(channels => {
    botUtils.tmiOptions.channels = channels.map(channel => channel.name)
    console.log(`ALL CHANNELS [${channels.length}]:`, channels.map(channel => channel.name).sort())
    
    channels.forEach(channel => !channel.moderated ? unmoderatedChannels.push(channel.name) : '')

    client = new tmi.client(botUtils.tmiOptions)
    client.setMaxListeners(100)
    client.connect()

    // TMI EVENT LISTENERS
    client.on('message', onMessageHandler)
    client.on('connected', (server, port) => console.log(`🆗 Connected to ${server}:${port}`))
  })
  .catch(err => console.log("❌ FETCHING CHANNELS ERROR: ", err))
})
.catch(err => console.log("🛑 MONGODB CONNECTION ERROR:", err))



// TMI MESSAGE HANDLER
function onMessageHandler(channel, userState, message, self) {
  if (self) return
  
  const ORIGINAL_MESSAGE = message
  const userChannel = `#${userState.username}`
  const userName = `@${userState["display-name"]}`
  message = message.toLowerCase()

  if (channel === "#cardsearcher") {
    if (message.startsWith("!join")) {
      const messageArray = message.split(' ')
      
      if (!["close", "open"].includes(messageArray[1]))
        return client.say(channel, `${userName}, ❓Usage: !join <open|close>`)
      
      Channel
      .findOne({ name: userChannel })
      .then(response => {
        if (!response) {
          new Channel({
            name: userChannel,
            moderated: messageArray[1] === "close"
          })
          .save()
          .then(response => {
            if (!response.moderated) unmoderatedChannels.push(response.name)

            client
            .join(userChannel)
            .then(_ => {
              console.log(`The bot joined ${userChannel}`, new Date().toLocaleString('en-ph'))
              return client.say(channel, `${userName}, awesome! CardSearcher has joined your channel. Don't forget to promote the bot to VIP or moderator.`)
            })
            .catch(err => {
              console.log("ERROR: Channel join error", err)
              return client.say(channel, `${userName}, oops! There's an error. Please try again.`)
            })
          })
          .catch(err => {
            console.log("ERROR: Channel save error", err)
            client.say(channel, `${userName}, oops! There's an error. Please try again.`)
          })
        } else {
          Channel
          .findOneAndUpdate(
            { name: userChannel },
            { moderated: messageArray[1] === "close" ? true : false, updated: Date.now() },
            { new: true }
          )
          .then(response => {
            if (!response.moderated)
              !unmoderatedChannels.includes(response.name) ? unmoderatedChannels.push(response.name) : null
            else
              unmoderatedChannels = unmoderatedChannels.filter(item => item !== response.name)

            return client.say(channel, `${userName}, your bot setting is now set to "${messageArray[1].toUpperCase()}".`)
          })
          .catch(err => {
            console.log("ERROR: Channel update error", err)
            client.say(channel, `${userName}, oops! There's an error. Please try again.`)
          })
        }
      })
    } else if (message.startsWith("!part")) {
      Channel
      .findOneAndDelete({ name: userChannel })
      .then(response => {
        if (!response) {
          return client.say(channel, `${userName}, CardSearcher hasn't joined your channel yet. ❓Usage: !join <open|close>`)
        }

        client
        .part(userChannel)
        .then(_ => {
          unmoderatedChannels = unmoderatedChannels.filter(channel => channel !== userChannel)
          console.log(`The bot left ${userChannel}`, new Date().toLocaleString('en-ph'))
          return client.say(channel, `${userName}, the bot has successfully left your channel.`)
        })
        .catch(err => {
          console.log("ERROR: Channel part error", err)
          return client.say(channel, `${userName}, oops! There's an error. Please try again.`)
        })
      })
      .catch(err => {
        console.log("ERROR: Channel delete error", err)
        client.say(channel, `${userName}, there was an error. Try again.`)
      })
    } else if (message.startsWith("!channels")) {
      Channel
      .find({})
      .sort({ name: 1 })
      .then(channels => {
        let channelList = channels.map(channel => `● ${channel.name.slice(1)}`)
        channelList = channelList.filter(channel => channel !== '● cardsearcher')
        return client.say(channel, `imGlitch channel(s) using CardSearcher [${channels.length - 1}]: ${channelList.join(', ')}`)
      })
      .catch(err => {
        console.log("ERROR: Channels search error", err)
        return client.say(channel, `${userName}, oops! There's an error. Please try again.`)
      })
    }
  } else if (unmoderatedChannels.includes(channel) || channel === userChannel || userState.mod) {
    if (message.startsWith("!search")) {
      const messageArray = message.split(' ')
      const searchArg = messageArray[1]
      const query = messageArray.slice(2).join(' ')

      switch (searchArg) {
        case undefined:
          return client.say(channel, "❓Usage: !search <full/partial card name>")
        case "--guide":
          return client.say(channel, `MONSTER: [🟡: Normal, 🟠: Effect, 🟤: Tuner, 🔵: Ritual, 🟣: Fusion, ⚪: Synchro, ⚫: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token], 🟢: SPELL, 🔴: TRAP, ✨: SKILL`)
        case "--random":
          const card = cardUtils.getRandomCard()
          const cardInfo = botUtils.getCardInfo(card)

          return client.say(channel, cardInfo)
        case "--image":
          if (!query) return client.say(channel, `❓Usage: !search --image <full/partial card name>`)
          
          if (!cardUtils.normalizeString(query)) return

          console.log(`🚀 [${channel}] SEARCHING FOR: "${query}"...`)
          return cardUtils.findClosestCard(query)
            .then(cardToShow => {
              if (!cardToShow.length) {
                console.log(`❎ Search Failed: could not find: "${query}"`)
                return client.say(channel,`${botUtils.returnErrMsg()}`)
              }
              
              if (cardToShow.length > 1) {
                const responseMessage = botUtils.getCardArray(cardToShow)
                if (responseMessage.length > 500)
                  return client.say(channel,`${userName}, your search yielded ${cardToShow.length.toLocaleString()} total possible cards.`)
                else
                  return client.say(channel, botUtils.getCardArray(cardToShow))
              }
              
              return botUtils.shortenUrlAndReply(client, channel, userName, cardToShow[0])
            })
        case "--list":
          if (!query) return client.say(channel, `❓Usage (max 100 cards): !search --list <keyword> `)
          
          if (!cardUtils.normalizeString(query)) return

          console.log(`🚀 [${channel}] SEARCHING LIST FOR: "${query}"...`)
          return cardUtils.findClosestCard(query, true)
            .then(cards => {
              if (!cards.length) {
                console.log(`❎ Search Failed: could not find: "${query}"`)
                return client.say(channel,`${botUtils.returnErrMsg()}`)
              }
    
              if (cards.length > 100)
                return client.say(channel,`${userName}, your search yielded ${cards.length.toLocaleString()} total possible cards.`)
              else
                return client.say(channel, botUtils.getCardArray(cards))
            })
        default:
          const searchQuery = ORIGINAL_MESSAGE.split(' ').slice(1).join(' ')
          
          if (!cardUtils.normalizeString(searchQuery)) return

          console.log(`🚀 [${channel}] SEARCHING FOR: "${searchQuery}"...`)
          return cardUtils.findClosestCard(searchQuery)
            .then(result => {
              if (!result.length) {
                console.log(`❎ Search Failed: could not find: "${searchQuery}"`)
                return client.say(channel,`${botUtils.returnErrMsg()}`)
              }
              
              if (result.length > 1) {
                const responseMessage = botUtils.getCardArray(result)
                if (responseMessage.length > 500)
                  return client.say(channel,`${userName}, your search yielded ${result.length.toLocaleString()} total possible cards.`)
                else
                  return client.say(channel, botUtils.getCardArray(result))
              }
              
              return client.say(channel, botUtils.getCardInfo(result[0]))
            })
      }
    }
  }
}