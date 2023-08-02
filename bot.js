require('dotenv').config()
const mongoose = require('mongoose')
const express = require('express')
const app = express()
const tmi = require('tmi.js')

const Channel = require('./models/channel')
const botUtils = require('./utils/bot_util')
const cardUtils = require('./utils/card_util')
const wakeUpDyno = require('./utils/wakeUpDyno')

let unmoderatedChannels = []


// EXPRESS SERVER START
app.get("/", (request, response) => {
  response.send("https://www.twitch.tv/cardsearcher")
})

app.listen(process.env.PORT, () => wakeUpDyno(process.env.HOME_URL))


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
    console.log('ALL CHANNELS:', channels.map(channel => channel.name).sort())
    
    channels.forEach(channel => !channel.moderated ? unmoderatedChannels.push(channel.name) : '')

    client = new tmi.client(botUtils.tmiOptions)
    client.setMaxListeners(100)
    client.connect()

    // TMI EVENT LISTENERS
    client.on('message', onMessageHandler)
    client.on('connected', onConnectedHandler)
  })
  .catch(err => console.log("❌ ERROR FETCHING CHANNELS: ", err))
})
.catch(err => console.log("🛑 MONGODB CONNECTION ERROR:", err))





// HELPER FUNCTIONS BELOW
function onConnectedHandler(server, port) {
  console.log(`🆗 Connected to ${server}:${port}`)
}

function onMessageHandler(channel, userState, message, self) {
  if (self) return
  
  message = message.toLowerCase()
  const userChannel = `#${userState.username}`
  const userName = `@${userState["display-name"]}`

  if (channel === "#cardsearcher") {
    if (message.startsWith("!join")) {
      const messageArray = message.split(' ')
      
      if (!["close", "open"].includes(messageArray[1])) {
        return client.say(channel, `${userName}, ❓Usage: !join <open|close>`)
      }
      
      Channel
      .findOne({
        name: userChannel
      })
      .then(response => {
        if (!response) {
          new Channel({
            name: userChannel,
            moderated: messageArray[1] === "close" ? true : false
          })
          .save()
          .then(response => {
            if (!response.moderated) {
              unmoderatedChannels.push(response.name)
            }

            client
            .join(userChannel)
            .then(_ => {
              console.log(`The bot joined ${userChannel}`, new Date().toLocaleString('en-ph'))
              return client.say(channel, `${userName}, awesome! CardSearcher has joined your channel. Don't forget to promote the bot to VIP/mod.`)
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
      .findOneAndDelete({
        name: userChannel
      })
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
        const channelList = channels.map(channel => `● ${channel.name.slice(1)}`)
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

          const cardToShow = cardUtils.findClosestCard(query)
          
          if (!cardToShow.length) {
            console.log("❎ Search Failed: could not find:", query)
            return client.say(channel,`${botUtils.returnErrMsg()}`)
          }
          
          if (cardToShow.length > 1) {
            const responseMessage = botUtils.getCardArray(cardToShow)
            if (responseMessage.length > 500)
              return client.say(channel,`${userName}, search yielded ${cardToShow.length.toLocaleString()} total possible cards.`)
            else
              return client.say(channel, botUtils.getCardArray(cardToShow))
          }
          
          return botUtils.shortenUrlAndReply(client, channel, userName, cardToShow[0])
        case "--list":
          if (!query) return client.say(channel, `❓Usage (max 100 cards): !search --list <keyword> `)
          
          if (!cardUtils.normalizeString(query)) return

          const cards = cardUtils.filterCardsbyKeyword(query)

          if (!cards.length) {
            console.log("❎ Search Failed: could not find:", query)
            return client.say(channel,`${botUtils.returnErrMsg()}`)
          }

          if (cards.length > 100)
            return client.say(channel,`${userName}, search yielded ${cards.length.toLocaleString()} total possible cards.`)
          else
            return client.say(channel, botUtils.getCardArray(cards))
        default:
          const searchQuery = messageArray.slice(1).join(' ')
          
          if (!cardUtils.normalizeString(searchQuery)) return

          const closestCard = cardUtils.findClosestCard(searchQuery)
          if (!closestCard.length) {
            console.log("❎ Search Failed: could not find:", searchQuery)
            return client.say(channel,`${botUtils.returnErrMsg()}`)
          }
          
          if (closestCard.length > 1) {
            const responseMessage = botUtils.getCardArray(closestCard)
            if (responseMessage.length > 500)
              return client.say(channel,`${userName}, search yielded ${closestCard.length.toLocaleString()} total possible cards.`)
            else
              return client.say(channel, botUtils.getCardArray(closestCard))
          }

          return client.say(channel, botUtils.getCardInfo(closestCard[0]))
      }
    }
  }
}