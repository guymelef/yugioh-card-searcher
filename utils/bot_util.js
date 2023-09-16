const {
  BITLY_GUID,
  BITLY_API,
  BITLY_TOKEN
} = require('./config')



const getSymbol = (type, types) => {
  const cardSymbols = {
    Normal: '🟡',
    Effect: '🟠',
    Ritual: '🔵',
    Fusion: '🟣',
    Synchro: '⚪',
    Tuner: '🟤',
    Spell: '🟢',
    Trap: '🔴',
    Xyz: '⚫',
    Token: '🃏',
    Link: '🔗',
    Pendulum: '🌗',
    Skill: '✨'
  }

  if (types) {
    let symbol
    types = types.split('/')

    if (types.includes("Pendulum")) symbol = cardSymbols["Pendulum"]
    else if (types.includes("Link")) symbol = cardSymbols["Link"]
    else if (types.length > 1) symbol = cardSymbols[types[1]]
    else symbol = cardSymbols[types[0]]

    return symbol || '🟡'
  } else {
    return cardSymbols[type] || ''
  }
}

const getCardInfo = (card) => {
  const lore = card?.lore ? `: ${card.lore.replace(/-{2,}/, '')}` : ''
  const types = card?.types ? `[${card.types}]` : ''

  if (["Spell", "Trap"].includes(card.type)) {
    return `🔎 ${card.name} [${card.property} ${card.type}] ${lore}`
  } else if (card.type === "Skill") {
    return `🔎 ${card.name} ${types} ${lore}`
  } else if (["Monster", "Token"].includes(card.type)) {
    if (types.includes("Pendulum"))
      return `🔎 ${card.name} (${card.attribute}) [${card.level}⭐] [◀${card.scale}▶] ${types} [ATK/${card.atk} DEF/${card.def}] ${lore}`
    
    if (types.includes("Link"))
      return `🔎 ${card.name} (${card.attribute}) ${types} [ATK/${card.atk} LINK—${card.linkRating}] [${formatArrows(card.linkArrows)}] ${lore}`
      
    return `🔎 ${card.name} (${card.attribute}) [${card.level}⭐] ${types} [ATK/${card.atk} DEF/${card.def}] ${lore}`
  } else {
    return `🔎 ${card.name} ${lore}`
  }
}

const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    let symbol
    if (card.type === "Monster") symbol = getSymbol(null, card.types)
    else symbol = getSymbol(card.type)
    
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} ${cards.length > 1 ? 'Cards' : 'Card'}] : ${cardsArray.join(', ')}`
}

const transformToBitlyUrl = async (url) => {
  const raw = JSON.stringify({
    group_guid: `${BITLY_GUID}`,
    domain: "bit.ly",
    long_url: url
  })

  const options = {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BITLY_TOKEN}`
    },
    redirect: "follow"
  }

  let link = await fetch(BITLY_API, options)
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
  return `${errorMessages[index]} 💀`
}





module.exports = {
  getSymbol,
  getCardInfo,
  getCardArray,
  transformToBitlyUrl,
  returnErrMsg,
}