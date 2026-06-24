const { TINYURL_API, tinyurlOptions } = require('../config/config')



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
  const lore = card.lore ? `: ${card.lore.replace(/-{2,}/, '')}` : ''
  const types = card.types ? `[${card.types}]` : ''
  const legend = card.legend ? '❮LEGEND❯' : ''

  if (["Spell", "Trap"].includes(card.type)) {
    return `${card.name} ${legend} [${card.property} ${card.type}] ${lore}`
  } else if (card.type === "Skill") {
    return `${card.name} ${legend} ${types} ${lore}`
  } else if (["Monster", "Token"].includes(card.type)) {
    if (types.includes("Pendulum"))
      return `${card.name} ${legend} (${card.attribute}) [${card.level}⭐] [◀${card.scale}▶] ${types} [ATK/${card.atk} DEF/${card.def}] ${lore}`
    
    if (types.includes("Link"))
      return `${card.name} ${legend} (${card.attribute}) ${types} [ATK/${card.atk} LINK—${card.linkRating}] [${formatArrows(card.linkArrows)}] ${lore}`
      
    return `${card.name} ${legend} (${card.attribute}) [${card.level}⭐] ${types} [ATK/${card.atk} DEF/${card.def}] ${lore}`
  } else {
    return `${card.name} ${legend} ${lore}`
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

const transformToTinyurl = async (url) => {
  tinyurlOptions.body = JSON.stringify({ url })

  let link = await fetch(TINYURL_API, tinyurlOptions)
  link = await link.json()
  link = link.data.tiny_url

  return link
}

const getSnapCardInfo = (card) => {
  const getCardSeries = (series) => {
    if (series) {
      if (series === 'Season Pass') return `Season Pass`
      else if (series === 'NA') return 'Unreleased'
      else return `S${series}`
    } else {
      return 'Summon'
    }
  }

  let ability = card.evolved ? `${card.text + ` Evolved: ${card.evolved}` }` : card.ability
  ability = ability.replace('<i>', '').replace('</i>', '')

  if (card.type === 'card') {
    return `✦ ″${card.name}″ [🔹${card.cost} 🔸${card.power}] ❮${getCardSeries(card.series)}❯ : ${ability}`
  } else {
    return `◉ ″${card.name}″ : ${card.ability}`
  }
}





module.exports = {
  getSymbol,
  getCardInfo,
  getCardArray,
  transformToTinyurl,
  getSnapCardInfo
}