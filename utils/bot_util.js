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
      🔎 ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} ${card.scale ? `[◀${card.scale}▶]` : ''} [${card.race}/${card.type.replace(/ Monster/g, '').replace(/ /g, '/')}] [ATK/${card.atk}${card.def || card.def === 0 ? ` DEF/${card.def}`: ''}${card.linkval ? ` LINK-${card.linkval}] [${card.linkmarkers.length > 1 ? 'Markers:' : 'Marker:'} ${card.linkmarkers.join(', ')}]` : ']'} : ${card.desc.replace(/-{40}/g, '')}
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


const scrapeYugipedia = (args) => {
  const requestOptions = {
    method: 'GET',
    headers: {
      "User-Agent": "Twitch Bot https://www.twitch.tv/cardsearcher"
    },
    redirect: 'follow'
  }

  return fetch(`https://yugipedia.com/api.php?action=query&format=json&redirects=true&list=search&srlimit=1&srwhat=nearmatch&srsearch=${encodeURIComponent(args.searchQuery)}`, requestOptions)
  .then(response => response.json())
  .then(result => {
    const pageTitle = result.query.search[0].title
    fetch(`https://yugipedia.com/api.php?action=query&format=json&redirects=true&prop=revisions&rvprop=content&formatversion=2&titles=${encodeURIComponent(pageTitle)}`)
    .then(response => response.json())
    .then(response => {
      const cardRaw = response.query.pages[0].revisions[0].content
      const name = response.query.pages[0].title

      const getProperty = (key) => {
        const regex = new RegExp(`${key} += .*\n`, 'g')

        if (["lore", "pendulum_effect"].includes(key)) {
          const cardLore = cardRaw.match(regex)
          if (cardLore) {
            return cardRaw.match(regex)[0].replace(/ +/g, ' ').slice(key.length + 3).replace(/<br \/>/g, ' ').replace(/\[\[\w*( *\w*)*\|/g, '').replace(/\[\[/g, '').replace(/]]/g, '').replace(/'{3}/g, '').replace(/'{2}/g, '\'').trim()
          }
          return null
        } else {
          const value = cardRaw.match(regex)
          return value ? value[0].replace(/ +/g, ' ').trim().slice(key.length + 3).trim() : null
        }
      }

      if (args.image) {
        const imageLink = `https://yugipedia.com/wiki/File:${getProperty('image')}`
        return shortenUrlAndReply(args.client, args.channel, args.userName, name, imageLink)
      }

      const type = getProperty('type')
      const types = getProperty('types')
      switch (type) {
        case "Spell":
        case "Trap":
          const race = getProperty("property")
          const desc = getProperty("lore")
          let markers
          if (race === "Link")
            markers = getProperty("link_arrows")
          args.client.say(args.channel, `🔎 ${name} [${race} ${type}] ${markers ? `[Markers: ${markers}]`: ''} : ${desc}`)
          break
        default:
          const monsterTypes = [type, getProperty("type2"), getProperty("type3"), getProperty("type4")].filter(type => type).join('/')

          if (!type && types) monsterTypes = types.replace(/ /g, '')

          const attribute = getProperty("attribute")
          const level = getProperty("level") || getProperty("rank")
          const scale = getProperty("scale")

          const atkdef = () => {
            const atk = getProperty("atk")
            const def = getProperty("def")
            if (monsterTypes.includes("Link")) {
              const markers = getProperty("link_arrows").split(', ')
              return `[ATK/${atk} LINK-${markers.length}] [Markers: ${markers.join(', ')}]`
            } else {
              return `[ATK/${atk} DEF/${def}]`
            }
          }

          const getLore = () => {
            const regular_lore = getProperty("lore")

            if(monsterTypes.includes("Pendulum")) {
              const pendulum_lore = getProperty("pendulum_effect")

              if (pendulum_lore) {
                return `[ Pendulum Effect ] ${pendulum_lore} [ Monster Effect ] ${regular_lore}`
              } else {
                return `${regular_lore}`
              }
            } else {
              return `${regular_lore}`
            }
          }

          args.client.say(args.channel, `🔎 ${name} (${attribute}) ${level ? `[${level}⭐]`: ''} ${scale ? `[◀${scale}▶]`: ''} [${monsterTypes}] ${atkdef()} : ${getLore()}`)

          break
      }
    })
    .catch(error => args.client.say(args.channel, `${args.userName}, there was an error. Try again.`))
  })  
  .catch(error => args.client.action(args.channel, "couldn't find any card(s) with that name, not even in the Shadow Realm. 👻"))
}



module.exports = {
  options,
  getSymbol,
  getCardInfo,
  getCardArray,
  shortenUrlAndReply,
  scrapeYugipedia
}