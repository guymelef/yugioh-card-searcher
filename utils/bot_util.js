require('dotenv').config()
const fetch = require('node-fetch')



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
  const type = card.type.split(' ')

  if (type.includes("Monster")) {
    cardInfo = `
      🔎 ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} [${card.race}/${card.type}] [ATK/${card.atk}${card.def ? ` DEF/${card.def}`: ''}${card.linkval ? ` LINK-${card.linkval}`: ''}]${card.scale ? ` [Scale: ${card.scale}]` : ''} : ${card.desc}
    `
  } else {
    cardInfo = `🔎 ${card.name} [${card.race} ${card.type}] : ${card.desc}`
  }

  return cardInfo
}


const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    const symbol = getSymbol(card.type.split(' ')[0])
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} Cards] : ${cardsArray.join(', ')}`
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



module.exports = {
  options,
  getSymbol,
  getCardInfo,
  getCardArray,
  shortenUrlAndReply
}