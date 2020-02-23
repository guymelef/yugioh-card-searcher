require('dotenv').config()
const fetch = require('node-fetch')
const jsdom = require("jsdom");
const { JSDOM } = jsdom;



const options = {
  options: { debug: process.env.DEBUG ? true : false },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
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


const getSymbol = (cardType) => cardSymbols[cardType] ? cardSymbols[cardType] : '🧡'


const getCardInfo = (card) => {
  let cardInfo

  if (card.type.includes("Monster")) {
    cardInfo = `
      🔎 ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} ${card.scale ? ` [ ${card.scale} ⚖ ]` : ''} [${card.race}${card.type === "Monster" ? " Monster": `/${card.type}`}] [ATK/${card.atk}${card.def || card.def === 0 ? ` DEF/${card.def}`: ''}${card.linkval ? ` LINK-${card.linkval}] [Markers: ${card.linkmarkers.join(', ')}]` : ']'} : ${card.desc.replace(/-{40}/g, '')}
    `
  } else {
    cardInfo = `🔎 ${card.name} [${card.race} ${card.type.replace('Card', '').trim()}] : ${card.desc}`
  }

  return cardInfo
}


const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    const symbol = getSymbol(card.type.split(' ')[0])
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} ${cards.length === 1 ? 'Card' : 'Cards'}] : ${cardsArray.join(', ')}`
}


const shortenUrlAndReply = (client, channel, userName, cardName, url) => {
  const raw = JSON.stringify({
    group_guid: `${process.env.BITLY_GUID}`,
    domain: "bit.ly",
    long_url: `${url}`
  })

  const requestOptions = {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.BITLY_TOKEN}`
    },
    redirect: "follow"
  }

  return fetch("https://api-ssl.bitly.com/v4/shorten", requestOptions)
    .then(response => response.json())
    .then(result => {
      return client.say(channel, `🖼 "${cardName}" - [ ${result.link} ]`)
    })
    .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
}


let lastRequest = ""
const scrapeYugipedia = (args) => {
  const requestOptions = {
    method: 'GET',
    headers: {
      "User-Agent": "Twitch Bot https://www.twitch.tv/cardsearcher"
    },
    redirect: 'follow'
  };
  
  const fetchYugipedia = () => {
    return fetch(`https://yugipedia.com/api.php?action=query&format=json&redirects=true&list=search&srlimit=1&srwhat=nearmatch&srsearch=${args.searchQuery}`, requestOptions)
    .then(response => response.json())
    .then(result => {
      lastRequest = new Date()
      const pageTitle = result.query.search[0].title
      JSDOM.fromURL(`https://yugipedia.com/wiki/${pageTitle}`).then(dom => {
        const document = dom.window.document
        const title = document.querySelector('.heading').textContent
        const image = document.querySelector('.cardtable-main_image-wrapper > a')["href"]
        const cardInfoTable = [...document.querySelector('.innertable > tbody').rows]
        const cardProperties = { }
        cardProperties.name = title

        if (args.image) return shortenUrlAndReply(args.client, args.channel, args.userName, title, image)

        cardInfoTable.forEach(row => {
          if (!row.cells[1]) {
            let lore = document.querySelector('.lore > p')
            if (lore) {
              lore = lore.innerHTML.replace(/<br>/g, ' ')
              let newLore = document.createElement('p')
              newLore.innerHTML = lore
              cardProperties.desc = newLore.textContent.trim()
            } else {
              cardProperties.desc = row.cells[0].textContent.trim().replace('Pendulum Effect', '[ Pendulum Effect ]').replace('Monster Effect', '[ Monster Effect ]')
            }
          } else if (["Password", "Effect types", "Status"].includes(row.cells[0].textContent.trim())) {
            return
          } else {
            switch (row.cells[0].textContent.trim().toLowerCase()) {
              case "card type":
                cardProperties.type = row.cells[1].textContent.trim()
                break
              case "property":
                cardProperties.race = row.cells[1].textContent.trim()
                break
              case "types":
                cardProperties.race = row.cells[1].textContent.trim().replace(/ /g, '')
                break
              case "atk / def":
                cardProperties.atk = row.cells[1].textContent.trim().match(/\d+/)[0]
                cardProperties.def = row.cells[1].textContent.trim().match(/\d+$/)[0]
                break
              case "atk / link":
                cardProperties.atk = row.cells[1].textContent.trim().match(/\d+/)[0]
                cardProperties.link = row.cells[1].textContent.trim().match(/\d{1}$/)[0]
                break
              case "pendulum scale":
                cardProperties.scale = row.cells[1].textContent.trim()
                break
              case "rank":
                cardProperties.level = row.cells[1].textContent.trim()
                break
              case "link arrows":
                cardProperties.linkmarkers = row.cells[1].textContent.trim().split(',')
                break
              default:
                cardProperties[row.cells[0].textContent.trim().toLowerCase()] = row.cells[1].textContent.trim()
                break
            }  
          }
        })
        cardProperties.card_images = [{ imageUrl: image}]
        return args.client.say(args.channel, getCardInfo(cardProperties))
      })
      .catch(err => args.client.say(args.channel, `${args.userName}, there was an error. Try again.`))
    })  
    .catch(err => args.client.action(args.channel, "couldn't find any card(s) with that name, not even in the Shadow Realm. 👻"))
  }

  const requestDuration = new Date() - lastRequest
  if (requestDuration < 1000) {
    return setTimeout(() => {
      return fetchYugipedia()
    }, 1000 - requestDuration)
  } else {
    return fetchYugipedia()
  }
}



module.exports = {
  options,
  getSymbol,
  getCardInfo,
  getCardArray,
  shortenUrlAndReply,
  scrapeYugipedia
}