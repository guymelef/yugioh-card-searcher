require('dotenv').config()
const tmi = require('tmi.js')
const fetch = require('node-fetch')
const wakeUpDyno = require('./wakeUpDyno')

const express = require('express')
const app = express()
const port = process.env.PORT

app.get("/", (request, response) => {
  response.send("Hello, I'm a Twitch bot.")
})

app.listen(port, () => wakeUpDyno('https://ygo-card-searcher.herokuapp.com/'))


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


function onMessageHandler (channel, userState, message, self) {
  if (self) return
  if (!["domainvalidators", "cardsearcher", "thesandvich"].includes(userState.username)) return

  const messageArray = message.split(' ')
  const command = messageArray[0].toLowerCase()
  const commandArg = messageArray.slice(1).join(' ').toLowerCase()

  switch (command) {
    case "!card":
      if (commandArg.length === 0) {
        client.say(channel, "❔ Try again with this syntax: !card <full/partial card name>")
        break
      } else {
        fetch(`https://db.ygoprodeck.com/api/v5/cardinfo.php?fname=${commandArg}`)
          .then(r => r.json())
          .then(r => {
            if (r.length === 1) {
              let cardInfo;
              if (r[0].type.includes("Monster")) {
                cardInfo = `
                  ${r[0].name} (${r[0].attribute}) [${r[0].level}⭐] [${r[0].race}/${r[0].type}] : ${r[0].desc} ATK/${r[0].atk} DEF/${r[0].def}
                  `
                if (r[0].type.includes("Synchro")) {
                  cardInfo = `⚪ ${cardInfo}`
                } else if (r[0].type.includes("Fusion")) {
                  cardInfo = `🟣 ${cardInfo}`
                } else {
                  cardInfo = `🟠 ${cardInfo}`
                }
              } else if (r[0].type.includes("Spell")) {
                cardInfo = `🟢 ${r[0].name} [${r[0].race} ${r[0].type}] : ${r[0].desc}`
              } else if (r[0].type.includes("Trap")) {
                cardInfo = `🔴 ${r[0].name} [${r[0].race} ${r[0].type}] : ${r[0].desc}`
              }

              client.say(channel, cardInfo)
            } else {
              const found = r.find(e => e.name.toLowerCase() === commandArg)
              if (found) {
                let cardInfo;
                if (found.type.includes("Monster")) {
                  cardInfo = `
                    ${found.name} (${found.attribute}) [${found.level}⭐] [${found.race}/${found.type}] : ${found.desc} ATK/${found.atk} DEF/${found.def}
                    `
                  if (found.type.includes("Synchro")) {
                    cardInfo = `⚪ ${cardInfo}`
                  } else if (found.type.includes("Fusion")) {
                    cardInfo = `🟣 ${cardInfo}`
                  } else {
                    cardInfo = `🟠 ${cardInfo}`
                  }
                } else if (found.type.includes("Spell")) {
                  cardInfo = `🟢 ${found.name} [${found.race} ${found.type}] : ${found.desc}`
                } else if (found.type.includes("Trap")) {
                  cardInfo = `🔴 ${found.name} [${found.race} ${found.type}] : ${found.desc}`
                }

                client.say(channel, cardInfo)
              } else {
                const cards = r.map(card => {                
                  if (card.type.includes("Synchro")) {
                    return `⚪ ${card.name}`
                  } else if (card.type.includes("Fusion")) {
                    return `🟣 ${card.name}`
                  } else if (card.type.includes("Trap")) {
                    return `🔴 ${card.name}`
                  } else if (card.type.includes("Spell")) {
                    return `🟢 ${card.name}`
                  } else {
                    return `🟠 ${card.name}`
                  }
                })
                client.say(channel, `📜 [${r.length} Cards] : ${cards.join(', ')}`)
              }
            }
          })
          .catch (_ => client.say(channel, 'No card found. 👻'))
        break
      }
    default:
      break
  }
}

function onConnectedHandler (server, port) {
  console.log(`💯  Connected to ${server}:${port}`)
}