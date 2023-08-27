const tmiOptions = {
  options: { debug: process.env.DEBUG === "true" },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  }
}

const getSymbol = (cardType) => {
  const cardSymbols = {
    Normal: '🟡',
    Effect: '🟠',
    Ritual: '🔵',
    Fusion: '🟣',
    Synchro: '⚪',
    Tuner: '🟤',
    Spell: '🟢',
    Trap: '🔴',
    XYZ: '⚫',
    Token: '🃏',
    Link: '🔗',
    Pendulum: '🌗',
    Skill: '✨'
  }

  return cardSymbols[cardType] || '🟡'
}

const getCardInfo = (card) => {
  if (["Spell", "Trap"].includes(card.type)) {
    return `🔎 ${card.name} [${card.property} ${card.type}] : ${card.lore}`
  } else if (card.type === "Skill") {
    return `🔎 ${card.name} ${card?.types ? `[${card.types}]` : ''} : ${card.lore}`
  } else if (card.type === "Monster" || card.type === "Token") {
    if (card.types.includes("Pendulum")) {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.level}⭐] [◀${card.scale}▶] [${card.types}] [ATK/${card.atk} DEF/${card.def}] : ${card.lore.replace(/-{2,}/, '')}
      `
    } else if (card.types.includes("Link")) {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.types}] [ATK/${card.atk} LINK—${card.linkRating}] [${formatArrows(card.linkArrows)}] : ${card.lore}
      `
    } else {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.level}⭐] ${card?.types ? `[${card.types}]` : ''} [ATK/${card.atk} DEF/${card.def}] : ${card.lore}
      `
    }
  } else {
    return `🔎 ${card.name} : ${card.lore}`
  }
}

const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    let symbol = ""
    if (card.type === "Monster") {
      symbol = card.types.split('/')
      if (symbol.includes("Pendulum")) symbol = getSymbol("Pendulum")
      else if (symbol.length > 1) symbol = getSymbol(symbol[1])
      else symbol = getSymbol(symbol[0])
    } else {
      symbol = getSymbol(card.type)
    }
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} ${cards.length > 1 ? 'Cards' : 'Card'}] : ${cardsArray.join(', ')}`
}

const transformToBitlyUrl = async (url) => {
  const raw = JSON.stringify({
    group_guid: `${process.env.BITLY_GUID}`,
    domain: "bit.ly",
    long_url: url
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

  let link = await fetch(process.env.BITLY_API, requestOptions)
  link = await link.json()
  link = link.link

  return link
}

const formatArrows = (array) => {
  const markers = {
    "Top-Left": '↖️',
    "Top-Center": '⬆️',
    "Top-Right": '↗️',
    "Middle-Left": '⬅️',
    "Bottom-Left": '↙️',
    "Bottom-Center": '⬇️',
    "Bottom-Right": '↘️',
    "Middle-Right": '➡️',
  }
  return array.map(arrow => markers[arrow.trim()]).join('')
}

const returnErrMsg = () => {
  const errorMessages = require('../data/error-messages.json')

  const index = Math.floor(Math.random() * errorMessages.length)
  return `🃏 ${errorMessages[index]}`
}





module.exports = {
  tmiOptions,
  getSymbol,
  getCardInfo,
  getCardArray,
  transformToBitlyUrl,
  returnErrMsg,
}