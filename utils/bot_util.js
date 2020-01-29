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


const getSymbol = (cardType) => {
  return cardSymbols[cardType] ? cardSymbols[cardType] : '🧡'
}


const getCardInfo = (card) => {
  let cardInfo
  const type = card.type.split(' ')

  if (type.includes("Monster")) {
    cardInfo = `
      🔎 ${card.name} (${card.attribute}) ${card.level ? `[${card.level}⭐]`: ''} [${card.race}/${card.type}] [ATK/${card.atk}${card.def ? ` DEF/${card.def}`: ''}] : ${card.desc}
    `
  } else {
    cardInfo = `🔎 ${card.name} [${card.race} ${card.type}] : ${card.desc}`
  }

  return cardInfo
}


const shortenUrlAndReply = (client, channel, userName, cardName, url) => {
  const myHeaders = new Headers()
  myHeaders.append("Content-Type", "application/json")
  myHeaders.append("Authorization", `Bearer ${process.env.BITLY_TOKEN}`)

  const raw = JSON.stringify({
    group_guid: `${process.env.BITLY_GUID}`,
    domain: "bit.ly",
    long_url: `${url}`
  })

  const requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
  }

  fetch("https://api-ssl.bitly.com/v4/shorten", requestOptions)
    .then(response => response.json())
    .then(result => client.say(channel, `${userName} ➡ [${cardName}] - ${result.link}`))
    .catch(err => client.action(channel, `couldn't find the card image you're looking for, ${userName}.`))
}



module.exports = {
  options,
  getSymbol,
  getCardInfo,
  shortenUrlAndReply
}