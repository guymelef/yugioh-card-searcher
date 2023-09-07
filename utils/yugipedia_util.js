const { requestOptions } = require('./bot_util')

let wikitext



const fetchFromYugipedia = async (cardName, cardPageId, cardPageTitle) => {
  const CARDS = []
  
  try {
    console.log(`📖 SEARCHING YUGIPEDIA... 【 ${cardName || cardPageId || cardPageTitle} 】`)
    let wikiContent
    
    if (cardPageId) {
      cardPageId = cardPageId.join('|')
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGEID}${cardPageId}`, requestOptions)
      wikiContent = await wikiContent.json()
    } else if (cardPageTitle) {
      cardPageTitle = cardPageTitle.join('|')
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGETITLE}${cardPageTitle}`, requestOptions)
      wikiContent = await wikiContent.json()
    } else if (cardName) {
      let response = await fetch(`${process.env.YUGIPEDIA_SEARCH}${encodeURIComponent(cardName)}`, requestOptions)
      response = await response.json()
    
      const pageId = response.query.search[0]?.pageid
      if (!pageId) return CARDS
    
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGEID}${pageId}`, requestOptions)
      wikiContent = await wikiContent.json()
    }
    
    const pages = wikiContent.query.pages
    if (pages.length) {
      for (let page of pages) {
        const name = page.title
        wikitext = page.revisions[0].content

        let card = createYugipediaCard(name)
        if (card.length) {
          card = card[0]
          card.pageId = page.pageid
          CARDS.push(card)
        }
      }
    }
    
    return CARDS
  } catch (err) {
    console.log(`🔴 [[ ${cardName} ]] YUGIPEDIA LOOKUP ERROR:`, err.message)
    console.log("🔷 STACK:", err.stack)
    return CARDS
  }
}

const createYugipediaCard = (cardName) => {
  const CARD = []

  let category
  let official
  if (wikitext.startsWith('{{Anime') || wikitext.startsWith('{{Duel Links')) {
    category  = 'stray'
    official = false
  } else if (wikitext.startsWith('{{Unofficial')) {
    official = false
  } else if (wikitext.startsWith('{{CardTable2') || wikitext.includes('{{CardTable2')) {
    official = true
  } else {
    official = false
  }

  let name = cardName
  let type = getProperty('card_type')
  let types = getProperty('types')
  let lore = getProperty('lore')
  let image = getProperty('image')
  let requirement = getProperty('requirement')

  if (!lore) return CARD
  
  if (['Spell', 'Trap'].includes(type)) {
    let property = getProperty('property')

    if (requirement) {
      lore = `[REQUIREMENT] ${requirement} [EFFECT] ${lore}`
      category = 'rush'
    } else {
      category = category || 'ocg'
    }

    CARD.push({ name, type, property, lore, image, category, official })
    return CARD
  }

  if (!types && lore) {
    category = 'stray'
    CARD.push({ name, lore, category, official })
    return CARD
  }

  if (!types && !lore) return CARD

  if (types.includes('Skill') || wikitext.startsWith('{{Duel Links Skill')) {
    type = 'Skill'
    category = category || 'ocg'

    CARD.push({ name, type, types, lore, image, category, official })
    return CARD
  }
  
  type = 'Monster'
  const isRush = getProperty('rush_duel')
  if (!category) category = (requirement || isRush) ? 'rush' : 'ocg'

  let attribute = getProperty('attribute')
  let atk = getProperty('atk')
  let def = getProperty('def')
  let level = getProperty('level')
  let linkArrows
  let linkRating
  let scale
  let pendulum_effect
  
  if (types.includes('Link')) {
    linkArrows = getProperty('link_arrows')
    linkRating = linkArrows.length.toString()
    
    CARD.push({ name, type, attribute, types, linkArrows, atk, linkRating, lore, image, category, official })
    return CARD
  }

  if (types.includes('Pendulum')) {
    scale = getProperty('pendulum_scale')
    pendulum_effect = getProperty('pendulum_effect')

    if (pendulum_effect) lore = `[ Pendulum Effect ] ${pendulum_effect} [ Monster Effect ] ${lore}`

    CARD.push({ name, type, attribute, types, level, scale, atk, def, lore, image, category, official })
    return CARD
  }

  if (category === 'rush') {
    let effectTypes = getProperty('effect_types')
    if (effectTypes && effectTypes.includes('Continuous')) effectTypes = `[CONTINUOUS EFFECT]`
    else if (effectTypes && effectTypes.includes('Multi-Choice')) effectTypes = `[MULTI-CHOICE EFFECT]`
    else effectTypes = `[EFFECT]`
    
    if (requirement) lore = `[REQUIREMENT] ${requirement} ${effectTypes} ${lore}`

    CARD.push({ name, type, attribute, types, level, atk, def, lore, image, category, official })
    return CARD
  }

  CARD.push({ name, type, attribute, types, level, atk, def, lore, image, category, official })
  return CARD
}

const getProperty = (prop) => {
  let regex = new RegExp(`\\| ${prop} += +.+\n`)
  if (prop === 'image') regex = new RegExp('\\| image += +([^|]*)')
  
  let propValue = wikitext.match(regex)
  if (propValue) {
    propValue = propValue[0].split(' = ')
    propValue = propValue[1].trim()
  } else {
    if (prop === 'image') return `https://yugipedia.com/wiki/File:Back-TF-EN-VG.png`
    return null
  }

  switch (prop) {
    case 'card_type':
    case 'property':
    case 'level':
    case 'attribute':
    case 'atk':
    case 'def':
    case 'pendulum_scale':
    case 'rush_duel':
    case 'effect_types':
      return propValue
    case 'lore':
    case 'pendulum_effect':
    case 'requirement':
      return propValue
        .replace(/\[\[([^\]]+\|)([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replaceAll('<br />', ' ')
        .replaceAll("''", '"')
    case 'types':
      propValue = propValue.replaceAll(' / ', '/')
      return propValue
    case 'image':
      propValue = propValue.split('; ')
      if (propValue.length > 1) propValue = `${process.env.YUGIPEDIA_IMG}${propValue[1]}`
      else propValue = `${process.env.YUGIPEDIA_IMG}${propValue[0]}`
      
      return propValue
    case 'link_arrows':
      propValue = propValue.split(', ')
      return propValue
  }
}





module.exports = {
  fetchFromYugipedia
}