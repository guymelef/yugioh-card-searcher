require('dotenv').config()

const tmi = require('tmi.js')
const fetch = require('node-fetch')
const wakeUpDyno = require('./wakeUpDyno')

const mongoose = require('mongoose')
const express = require('express')
const app = express()
const port = process.env.PORT

const Channel = require('./models/channel')
const Skill = require('./models/skill')
const Counter = require('./models/counter')
const utils = require('./utils/bot_util')

let unmoderatedChannels = []


// EXPRESS SERVER START
app.get("/", (request, response) => {
  response.send("https://www.twitch.tv/cardsearcher")
})

app.listen(port, () => wakeUpDyno('https://ygo-card-searcher.herokuapp.com/'))
// EXPRESS SERVER END


// CONNECT TO MONGOOSE & START TMI CLIENT
let client
let throwCount
console.log("▶ Connecting to MongoDB...")
mongoose
.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
})
.then(data => { 
  console.log("Ⓜ Connected to MongoDB!")
  
  Channel
  .find({})
  .then(channels => {
    utils.options.channels = channels.map(channel => channel.name)
    console.log("ALL CHANNELS:", utils.options.channels)
    
    client = new tmi.client(utils.options)
    client.setMaxListeners(100)

    channels.forEach(channel => {
      if (!channel.moderated) unmoderatedChannels.push(channel.name)
    })
    console.log("OPEN CHANNELS:", unmoderatedChannels)

    client.connect()

    // TMI EVENT LISTENERS
    client.on('message', onMessageHandler)
    client.on('connected', onConnectedHandler)

    // get current throw count
    Counter.findOne({ name: "throw_counter"})
    .then(response => { 
      throwCount = response.count
      console.log("😎 Received cards thrown count!")
    })
    .catch(err => console.log("❌ ERROR FETCHING COUNTER:", err.message))
  })
  .catch(err => console.log("❌ ERROR: ", err.message))
})
.catch(err => console.log("🛑 MongoDB Connection Error:", err.message))
// CONNECT TO MONGOOSE & START TMI CLIENT END


// HELPER FUNCTIONS BELOW
function onConnectedHandler (server, port) {
  console.log(`🆗 Connected to ${server}:${port}`)
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
            console.log("OPEN CHANNELS:", unmoderatedChannels)
            client.join(userChannel)
            client.say(channel, `${userName}, awesome! CardSearcher has now joined your channel. Don't forget to promote the bot to VIP or moderator.`)
          })
          .catch(err => client.say(channel, `${userName}, oops! There's an error. Please try again.`))
        } else {
          Channel
          .findOneAndUpdate(
            { name: userChannel },
            { moderated: messageArray[1] === "--strict" ? true : false, updated: Date.now() },
            { new: true }
          )
          .then(response => {
            if (!response.moderated) {
              !unmoderatedChannels.includes(response.name) ? unmoderatedChannels.push(response.name) : null
            } else {
              unmoderatedChannels = unmoderatedChannels.filter(item => item !== response.name)
            }

            console.log("OPEN CHANNELS:", unmoderatedChannels)
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
        
        unmoderatedChannels = unmoderatedChannels.filter(item => item !== userChannel)
        return console.log("OPEN CHANNELS:", unmoderatedChannels)
      })
      .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
    } else if (message.startsWith("!channels")) {
      Channel
      .find({})
      .sort({ name: 1 })
      .then(channels => {
        channelList = channels.map(channel => `● ${channel.name.slice(1)}`)
        channelList = channelList.filter(channel => channel !== '● cardsearcher')
        return client.say(channel, `imGlitch ${channels.length - 1} channels are currently using the bot: ${channelList.join(', ')}`)
      })
    }
  } else if (unmoderatedChannels.includes(channel) || channel === userChannel || userState.mod) {
    if (message.startsWith("!search")) {
      const messageArray = message.split(' ')
      const searchArg = messageArray[1]
      const query = messageArray.slice(2).join(' ').toLowerCase()

      switch (searchArg) {
        case undefined:
          client.say(channel, "❓ To search for cards, follow this syntax: !search <full/partial card name>")
          break
        case "--guide":
          client.say(channel, `MONSTER: [💛: Normal, 🧡: Effect, 💙: Ritual, 💜: Fusion, 🤍: Synchro, 🖤: XYZ, 🌗: Pendulum, 🔗: Link, 🃏: Token], 💚: SPELL, ❤️: TRAP, ✨: SKILL`)
          break
        case "--random":
          fetch('https://db.ygoprodeck.com/api/v6/randomcard.php')
          .then(card => card.json())
          .then(card => {
            const cardInfo = utils.getCardInfo(card)
            return client.say(channel, cardInfo)
          })
          .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
          break
        case "--image":
          if (!query) {
            client.say(channel, `${userName}, please provide a unique card name to search for.`)
          } else {
            fetch(`https://db.ygoprodeck.com/api/v6/cardinfo.php?fname=${query}`)
            .then(cards => cards.json())
            .then(cards => {
              if (cards.length > 1) {
                const found = cards.find(card => card.name.toLowerCase() === query)
                return found ? utils.shortenUrlAndReply(client, channel, userName, found.name, found.card_images[0].image_url)
                : client.say(channel, `${userName}, your search returned multiple cards. Please provide a unique card name.`)
              } else {
                return utils.shortenUrlAndReply(client, channel, userName, cards[0].name, cards[0].card_images[0].image_url)
              }
            })
            .catch (err => utils.scrapeYugipedia({ client, channel, userName, searchQuery: query, image: true }))
          }
          break
        case "--list":
          if (!query) {
            client.say(channel, `${userName}, to view a list of cards, provide a search term. Example: !search --list blue-eyes`)
          } else {
            fetch(`https://db.ygoprodeck.com/api/v6/cardinfo.php?fname=${query}`)
            .then(cards => cards.json())
            .then(cards => {
              if (cards.length > 100) {
                return client.say(channel,`${userName}, your search yielded a total of ${cards.length.toLocaleString()} cards! Please refine your search and try again.`)
              } else {
                return client.say(channel, utils.getCardArray(cards))
              }
            })
            .catch (err => client.action(channel, "couldn't find any card(s) with that name, not even in the Shadow Realm. 👻"))
          }
          break
        case "--throw":
          fetch(`https://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`)
          .then(response => response.json())
          .then(response => {
            const channelViewers = response.chatters.viewers
            const randomUserIndex = Math.floor(Math.random() * channelViewers.length)
            let randomUserName = channelViewers[randomUserIndex]

            if (randomUserName === userName.slice(1).toLowerCase()) {
              randomUserName = channel.slice(1)
            }

            return fetch('https://db.ygoprodeck.com/api/v6/randomcard.php')
            .then(card => card.json())
            .then(card => {
              if (card.name.includes("Exodia") || card.name.includes("Forbidden One")) {
                throwCount += 5
                client.action(channel, `: ... CurseLit PowerUpL DarkMode PowerUpR CurseLit ... SAY GOODBYE TO EXODIAAA!!! ${userName.slice(1)} throws ${randomUserName}'s Exodia cards off the boat! 【Cards Thrown: ${throwCount.toLocaleString()}】`)
                return Counter.findOneAndUpdate({
                  name: "throw_counter",
                  count: throwCount
                })
                .then(response => console.log("🆙 COUNTER INCREASED!"))
                .catch(err => console.log("😓 ERROR UPDATING COUNTER", err.message))
              } else {
                throwCount += 1
                client.action(channel, `: ${userName.slice(1)} throws ${randomUserName}'s "${card.name}" card off the boat! DarkMode 【Cards Thrown: ${throwCount.toLocaleString()}】`)
                return Counter.findOneAndUpdate({
                  name: "throw_counter",
                  count: throwCount
                })
                .then(response => console.log("🆙 COUNTER INCREASED!"))
                .catch(err => console.log("😓 ERROR UPDATING COUNTER", err.message))
              }
            })
            .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
          })
          .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
          break
        case "--skill":
          if (!query) {
            Skill.find({})
            .then(skills => client.say(channel, `❓ There are currently [${skills.length}] Duel Links skills. To search for one, follow this syntax: !search --skill <full/partial skill name>`))
            .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
          } else {
            Skill.find({ name: { $regex: query, $options: 'i' } })
            .then(skills => {
              if (skills.length === 1) {
                return client.say(channel, `✨ "${skills[0].name}" : ${skills[0].desc} 【${skills[0].characters.length === 1 ? `${skills[0].characters[0]}`: `${skills[0].characters.map(char => `• ${char}`).sort().join(', ')}`}】`)
              } else if (skills.length > 1) {
                return client.say(channel, `📜 [${skills.length} Skills] : ${skills.map(skill => `✨${skill.name}`).join(', ')}`)
              } else {
                return client.action(channel, `couldn't find any "${query}" skill, not even in the Shadow Realm. 👻`)
              }
            })
            .catch(err => client.action(channel, `couldn't find any "${query}" skill, not even in the Shadow Realm. 👻`))
          }
          break
        default:
          const searchQuery = messageArray.slice(1).join(' ').toLowerCase()
          fetch(`https://db.ygoprodeck.com/api/v6/cardinfo.php?fname=${searchQuery}`)
          .then(cards => cards.json())
          .then(cards => {
            if (cards.length === 1) {
              return client.say(channel, utils.getCardInfo(cards[0]))
            } else {
              const found = cards.find(card => card.name.toLowerCase() === searchQuery)
              if (found) return client.say(channel, utils.getCardInfo(found))
              
              if (cards.length <= 20) {
                return client.say(channel, utils.getCardArray(cards))
              } else if (cards.length <= 100) {
                return client.say(channel,`${userName}, your search yielded ${cards.length} cards. Be more specific or view the list with: !search --list ${searchQuery}`)
              } else {
                return client.say(channel,`${userName}, your search yielded a total of ${cards.length.toLocaleString()} cards! Please refine your search and try again.`)
              }
            }
          })
          .catch (err => {
            const args = { client, channel, userName, searchQuery }
            return utils.scrapeYugipedia(args)
          })
          break 
      }
    }

    return
  }
}