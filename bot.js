require('dotenv').config()
const tmi = require('tmi.js')
const fetch = require('node-fetch')
const wakeUpDyno = require('./wakeUpDyno')

const express = require('express')
const app = express()
const port = process.env.PORT


// EXPRESS SERVER
app.get("/", (request, response) => {
  response.send("https://www.twitch.tv/cardsearcher")
})

app.listen(port, () => wakeUpDyno('https://ygo-card-searcher.herokuapp.com/'))
// EXPRESS SERVER END


const options = {
  options: { debug: process.env.DEBUG ? true : false },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  },
  channels: [
    "cardsearcher",
    "thesandvich",
    "nifroth",
    "mcblueskies",
    "moomoosaru",
  ]
}

const unModeratedChannels = [
  '#nifroth',
  '#moomoosaru,
]

const client = new tmi.client(options)

client.on('message', onMessageHandler)
client.on('connected', onConnectedHandler)

client.connect()


function onConnectedHandler (server, port) {
  console.log(`💯  Connected to ${server}:${port}`)
}

function onMessageHandler (channel, userState, message, self) {
  if (self) return

  if (unModeratedChannels.includes(channel) || channel === `#${userState.username}` || userState.mod) {
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
              return sendInfoForOneCard(card[0], channel)
            })
        } else {
          fetch(`https://db.ygoprodeck.com/api/v5/cardinfo.php?fname=${commandArg}`)
            .then(cards => cards.json())
            .then(cards => {
              if (cards.length === 1) {
                return sendInfoForOneCard(cards[0], channel)
              } else if (cards.length > 100) {
                return client.say(channel, `@${userState['display-name']}, your search yielded ${cards.length} cards! Refine your search query and try again.`)
              } else {
                const found = cards.find(card => card.name.toLowerCase() === commandArg)
                if (found) {
                  return sendInfoForOneCard(found, channel)
                } else {
                  const cardsArray = cards.map(card => {                
                    const symbol = getSymbol(card.type.split(' ')[0])
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

const cardSymbols = {
  Normal: '💛',
  Effect: '🧡',
  Ritual: '💙',
  Fusion: '💜',
  Synchro: '🤍',
  Spell: '💚',
  Trap: '❤️',
  XYZ: '🖤',
  Token: '🃏',
  Link: '🔗',
  Pendulum: '🌗',
  Skill: '✨'
}

const getSymbol = (cardType) => {
  return cardSymbols[cardType] ? cardSymbols[cardType] : '🧡'
}

const sendInfoForOneCard = (card, channel) => {
  let cardInfo;
  const type = card.type.split(' ')

  if (type.includes("Monster")) {
    cardInfo = `
      💡 ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} [${card.race}/${card.type}] [ATK/${card.atk}${card.def ? ` DEF/${card.def}`: ''}] : ${card.desc}
    `
  } else {
    cardInfo = `💡 ${card.name} [${card.race} ${card.type}] : ${card.desc}`
  }


  client.say(channel, cardInfo)
}
