require('dotenv').config()
const tmi = require('tmi.js')
const fetch = require('node-fetch')
const wakeUpDyno = require('./wakeUpDyno')

const mongoose = require('mongoose')
const express = require('express')
const app = express()
const port = process.env.PORT

const Channel = require('./models/channel')
const utils = require('./utils/bot_util')



// EXPRESS SERVER START
app.get("/", (request, response) => {
  response.send("https://www.twitch.tv/cardsearcher")
})

app.listen(port, () => wakeUpDyno('https://ygo-card-searcher.herokuapp.com/'))
// EXPRESS SERVER END



// MONGOOSE START
console.log("▶ Connecting to MongoDB...")
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
  })
  .then(_ => console.log("Ⓜ Connected to MongoDB!"))
  .catch(err => console.log("🛑 MongoDB Error:", err.message))
// MONGOOSE END



// TMI CLIENT START
const client = new tmi.client(utils.options)

client.on('message', onMessageHandler)
client.on('connected', onConnectedHandler)

client.connect()
// TMI CLIENT END



// HELPER FUNCTIONS BELOW
let unmoderatedChannels = []
function onConnectedHandler (server, port) {
  console.log(`🆗 Connected to ${server}:${port}`)
  Channel
    .find({})
    .then(channels => {
      channels.forEach(channel => {
        client.join(channel.name)
        !channel.moderated ? unmoderatedChannels.push(channel.name) : null
      })
    })
    .catch(err => console.log("❌ ERROR: ", err.message))
}

function onMessageHandler (channel, userState, message, self) {
  if (self) return
  
  const userChannel = `#${userState.username}`
  const userName = `@${userState["display-name"]}`

  if (channel === "#cardsearcher") {
    if (message.startsWith("!usebot")) {
      const messageArray = message.split(' ')
      
      if (!["--strict", "--open"].includes(messageArray[1])) {
        return client.say(channel, `${userName}, please provide an argument to the command. Read the panels for more info.`)
      }
      
      Channel
        .findOne({
          name: userChannel
        })
        .then(response => {
          if (!response) {
            new Channel({
              name: userChannel,
              moderated: messageArray[1] === "--strict" ? true : false
            })
            .save()
            .then(response => {
              if (!response.moderated) {
                unmoderatedChannels.push(response.name)
              }              
              console.log("FREE CHANNELS", unmoderatedChannels)
              client.join(userChannel)
              client.say(channel, `${userName}, awesome! CardSearcher has now joined your channel. Don't forget to promote the bot to VIP or moderator.`)
            })
            .catch(err => client.say(channel, `${userName}, oops! There's an error. Please try again.`))
          } else {
            Channel
              .findOneAndUpdate(
                { name: userChannel },
                { moderated: messageArray[1] === "--strict" ? true : false },
                { new: true }
              )
              .then(response => {
                if (!response.moderated) {
                  !unmoderatedChannels.includes(response.name) ? unmoderatedChannels.push(response.name) : null
                } else {
                  unmoderatedChannels = unmoderatedChannels.filter(item => item !== response.name)
                }

                console.log("FREE CHANNELS", unmoderatedChannels)
                return client.say(channel, `${userName}, your bot setting has been updated to "${messageArray[1].substring(2).toUpperCase()}".`)
              })
              .catch(err => client.say(channel, `${userName}, oops! There's an error. Please try again.`))
          }
        })
    } else if (message.startsWith("!killbot")) {
      Channel
        .findOneAndDelete({
          name: userChannel
        })
        .then(response => {
          if (!response) {
            return client.say(channel, `${userName}, the bot hasn't joined your channel yet. Use the !usebot command to enable it.`)
          }

          client.part(userChannel)
            .then(data => {
              return client.say(channel, `${userName}, the bot has successfully left your channel.`)
            })
            .catch (err => client.say(channel, `${userName}, oops! There's an error. Please try again.`))
          
          return unmoderatedChannels = unmoderatedChannels.filter(item => item !== userChannel)
        })
        .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
    }
  } else if (unmoderatedChannels.includes(channel) || channel === userChannel || userState.mod) {
    const messageArray = message.split(' ')
    const command = messageArray[0].toLowerCase()
    const commandArg = messageArray.slice(1).join(' ').toLowerCase()

    switch (command) {
      case "!search":
        if (!messageArray[1]) {
          return client.say(channel, "❓ To search for cards, follow this syntax: !card <full/partial card name>")
        } else if (messageArray[1] === "--guide") {
          return client.say(channel, `MONSTER: [💛: Normal, 🧡: Effect, 💙: Ritual, 💜: Fusion, 🤍: Synchro, 🖤: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token], 💚: SPELL, ❤️: TRAP, ✨: SKILL`)
        } else if (messageArray[1] === "--random") {
          fetch('https://db.ygoprodeck.com/api/v5/randomcard.php')
            .then(card => card.json())
            .then(card => {
              const cardInfo = utils.getCardInfo(card[0])
              return client.say(channel, cardInfo)
            })
        } else if (messageArray[1] === "--image") {
          fetch(`https://db.ygoprodeck.com/api/v5/cardinfo.php?fname=${commandArg}`)
            .then(cards => cards.json())
            .then(cards => {
              if (cards.length > 1) {
                return client.say(channel, `${userName}, multiple cards found. Please refine your search.`)
              } else {
                return utils.shortenUrlAndReply(client, channel, userName, cards[0].name, cards[0].card_images[0].image_url)
              }
            })
            .catch(err => client.action(channel, `couldn't find the card image you're looking for, ${userName}.`))
        } else {
          fetch(`https://db.ygoprodeck.com/api/v5/cardinfo.php?fname=${commandArg}`)
            .then(cards => cards.json())
            .then(cards => {
              if (cards.length === 1) {
                const cardInfo = utils.getCardInfo(cards[0])
                return client.say(channel, cardInfo)
              } else if (cards.length > 100) {
                return client.say(channel, `@${userState['display-name']}, your search yielded ${cards.length} cards! Refine your search query and try again.`)
              } else {
                const found = cards.find(card => card.name.toLowerCase() === commandArg)
                if (found) {
                  const cardInfo = utils.getCardInfo(found)
                  return client.say(channel, cardInfo)
                } else {
                  const cardsArray = cards.map(card => {                
                    const symbol = utils.getSymbol(card.type.split(' ')[0])
                    return `${symbol}${card.name}`
                  })
                  return client.say(channel, `📜 [${cards.length} Cards] : ${cardsArray.join(', ')}`)
                }
              }
            })
            .catch (_ => client.action(channel, "couldn't find any card(s) with that query, not even in the Shadow Realm. 👻"))
        }
        break
      default:
        break
    }
  } else {
    return
  }
}