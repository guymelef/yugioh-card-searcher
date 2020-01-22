require('dotenv').config()
const tmi = require('tmi.js')
const fetch = require('node-fetch')
const wakeUpDyno = require('./wakeUpDyno')

const express = require('express')
const app = express()
const port = process.env.PORT


// EXPRESS SERVER
app.get("/", (request, response) => {
  response.send("Hello, I'm a Twitch bot.")
})

app.listen(port, () => wakeUpDyno('https://ygo-card-searcher.herokuapp.com/'))
// EXPRESS SERVER END


const options = {
  options: { debug: true },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  },
  channels: ["thesandvich", "cardsearcher"]
}

const client = new tmi.client(options)

client.on('message', onMessageHandler)
client.on('connected', onConnectedHandler)

client.connect()


function onConnectedHandler (server, port) {
  console.log(`💯  Connected to ${server}:${port}`)
}

function onMessageHandler (channel, userState, message, self) {
  if (self) return
  if (!["domainvalidators", "cardsearcher", "thesandvich"].includes(userState.username)) return

  const messageArray = message.split(' ')
  const command = messageArray[0].toLowerCase()
  const commandArg = messageArray.slice(1).join(' ').toLowerCase()

  switch (command) {
    case "!card":
      if (commandArg.length === 0) {
        client.say(channel, "❓ To search for cards, follow this syntax: !card <full/partial card name>")
      } else if (messageArray[1] === "*random") {
        fetch('https://db.ygoprodeck.com/api/v5/randomcard.php')
          .then(card => card.json())
          .then(card => {
            sendInfoForOneCard(card[0], channel)
          })
      } else {
        fetch(`https://db.ygoprodeck.com/api/v5/cardinfo.php?fname=${commandArg}`)
          .then(cards => cards.json())
          .then(cards => {
            if (cards.length === 1) {
              sendInfoForOneCard(cards[0], channel)
            } else {
              const found = cards.find(card => card.name.toLowerCase() === commandArg)
              if (found) {
                sendInfoForOneCard(found, channel)
              } else {
                const cardsArray = cards.map(card => {                
                  const symbol = getSymbol(card.type)
                  return `${symbol} ${card.name}`
                })
                client.say(channel, `📜 [${cards.length} Cards] : ${cardsArray.join(', ')}`)
              }
            }
          })
          .catch (_ => client.action(channel, "couldn't find any card(s) with that query, not even in the Shadow Realm. 👻"))
      }
      break
    default:
      break
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
  Link: '🔗',
  Pendulum: '🌗',
  Skill: '✨'
}

const getSymbol = (cardType) => {
  const type = cardType.split(' ')[0]
  return cardSymbols[type] ? cardSymbols[type] : '🧡'
}

const sendInfoForOneCard = (card, channel) => {
  let cardInfo;
  const type = card.type.split(' ')

  if (type.includes("Monster")) {
    cardInfo = `
      ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} [${card.race}/${card.type}] : ${card.desc} ATK/${card.atk} ${card.def ? `DEF/${card.def}`: ''}
      `
    const symbol = getSymbol(card.type)
    cardInfo = `${symbol} ${cardInfo}`
  } else {
    cardInfo = `${cardSymbols.type[0]} ${card.name} [${card.race} ${card.type}] : ${card.desc}`
  }


  client.say(channel, cardInfo)
}