const { distance } = require("fastest-levenshtein")
const cheerio = require('cheerio')

const { OcgCard, RushCard, StrayCard } = require('../models/card')
const BotVariable = require('../models/variable')

let CARDS
let LAST_RANDOM_CARD
let YGOPDCOUNT



const fetchAllData = async () => {
    try {
      const ocgCards = await OcgCard.find({}).select('-_id -__v').lean().exec()
      const rushCards = await RushCard.find({}).select('-_id -__v').lean().exec()
      const strayCards = await StrayCard.find({}).select('-_id -__v').lean().exec()
      CARDS = [...ocgCards, ...rushCards, ...strayCards].sort((a, b) => a.name.localeCompare(b.name))
      console.log(`🟩 All [${CARDS.length.toLocaleString()}] cards fetched!`)

      const ygopdCount = await BotVariable.findOne({ name: 'YGOPRODeck' })
      YGOPDCOUNT = ygopdCount.card_count
      console.log(`🟩 YGOPD card count (${ygopdCount.last_update}): ${YGOPDCOUNT.toLocaleString()}`)
    } catch (err) {
      console.log("🔴 CARDS FETCH ERROR:", err.message)
      console.log("🔷 STACK:", err.stack)
    }
}

const normalizeString = (string) => {
  return string
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[★☆\s+]/g, "")
    .replace(/[^\w/@#.]|_/g, "")
}

const getRandomCard = () => {
  const index = Math.floor(Math.random() * CARDS.length)
  const card = CARDS[index]
  
  if (LAST_RANDOM_CARD === card.name) return getRandomCard()
  else LAST_RANDOM_CARD = card.name

  return card
}

const findClosestCard = async (keyword, bulk = false) => {
  const USER_KEYWORD = keyword
  let keywordArr = keyword.toLowerCase().trim().replace(/\s+/g, " ").split(' ')
  keywordArr = keywordArr.map(word => normalizeString(word))
  keyword = normalizeString(keyword)
  const DISTANCEARRAY = []

  let exactMatch = []
  let queryMatches = []
  let keywordMatches = []
  let possibleMatches = []
  let partialMatches = []
  let remoteMatch = []

  for (let card of CARDS) {
    const cardName = normalizeString(card.name)
    let cardNameArr = card.name.toLowerCase().split(' ')
    cardNameArr = cardNameArr.map(word => normalizeString(word))
    
    DISTANCEARRAY.push(distance(cardName, keyword))

    if (cardName === keyword && !bulk) {
      exactMatch.push(card)
      console.log("↪️  sending exact match...")
      return exactMatch
    }
    
    if (cardName.includes(keyword)) {
      queryMatches.push(card)
      continue
    }

    if (!queryMatches.length) {
      let matches = 0
      let closeMatches = 0

      if (keywordArr.length > 1 && cardNameArr.length > 1) {
        for (let word of keywordArr) {
          if (cardName.includes(word)) {
            matches++
            closeMatches++
            continue
          }
          
          if (word.length > 3) {
            for (let string of cardNameArr) {
              if (string.length > 3 && distance(word, string) < 3) {
                closeMatches++
                break
              }
            }
          }
        }
  
        if (matches === keywordArr.length) {
          keywordMatches.push(card)
          continue
        }
      }
      
      if (!keywordMatches.length) {
        if (keywordArr.length === 1) {
          let possibleMatch = false

          if (keyword.length > 3) {
            for (let word of cardNameArr) {
              const levDistance = distance(word, keyword)
              if (word.length >= 10 && levDistance < 4) {
                possibleMatch = true
                possibleMatches.push(card)
                break
              } else if (word.length > 3 && levDistance < 3) {
                possibleMatch = true
                possibleMatches.push(card)
                break
              }
            }
          }

          if (possibleMatch) continue
        }

        if (closeMatches === keywordArr.length) {
          possibleMatches.push(card)
          continue
        }
        
        if (keywordArr.length > 1 && distance(cardName, keyword) < 4) {
          possibleMatches.push(card)
          continue
        }

        if (distance(keyword, cardName.slice(0, keyword.length)) < 3) {
          possibleMatches.push(card)
          continue
        }

        if (keywordArr.length === 2) {
          let possibleMatch = false
          for (let word of cardNameArr) {
            if (word.length > 3 && distance(word, keyword) < 3) {
              possibleMatch = true
              possibleMatches.push(card)
              break
            }
          }
  
          if (possibleMatch) continue
        }

        if (!possibleMatches.length) {
          if (keywordArr.length === 2 && matches === 1) partialMatches.push(card)
          else if (keywordArr.length > 2 && matches / keywordArr.length > 0.6) partialMatches.push(card)
        }
      }
    }
  }

  if (!queryMatches.length || !keywordMatches.length || !possibleMatches.length || !partialMatches.length) {
    const min = Math.min(...DISTANCEARRAY)
    if (min === keyword.length) remoteMatch = []
  
    const minArray = []
    DISTANCEARRAY.forEach((num, index) => { if (num === min) minArray.push(index) })
    for (let index of minArray) {
      if (normalizeString(CARDS[index].name)[0] === keyword[0]) {
        remoteMatch.push(CARDS[index])
        break
      }
    }
  }
  
  if (bulk) {
    if (queryMatches.length) {
      console.log("↪️  sending query matches...")
      return queryMatches
    } 
    
    if (keywordMatches.length) {
      console.log("↪️  sending keyword matches...")
      return keywordMatches
    }
    
    if (possibleMatches.length) {
      console.log("↪️  sending possible matches...")
      return possibleMatches
    }
    
    if (partialMatches.length) {
      console.log("↪️  sending partial matches...")
      return partialMatches
    }

    if (remoteMatch.length) {
      console.log("↪️  sending remote match...")
      return CARDS.filter(card => card.name.includes(remoteMatch[0].name))
    } else {
      return remoteMatch
    }
  } else {
    if (queryMatches.length) {
      console.log("↪️  sending query matches...")
      return queryMatches
    }

    if (keywordMatches.length) {
      console.log("↪️  sending keyword matches...")
      return keywordMatches
    }

    const yugipediaCard = await createCard(USER_KEYWORD)
    if (yugipediaCard.length) {
      console.log(`👑 YUGIPEDIA ENTRY FOUND: "${yugipediaCard[0].name}"`)
      console.log(yugipediaCard[0])
      addNewCardsToDb(yugipediaCard)
      return yugipediaCard
    }

    if (possibleMatches.length) {
      console.log("↪️  sending possible matches...")
      return possibleMatches
    }

    if (partialMatches.length) {
      console.log("↪️  sending partial matches...")
      return partialMatches
    }

    console.log("↪️  sending remote match...")
    return remoteMatch
  }
}

const createCard = async (card) => {
  const USER_STRING = card
  card = card.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  const CARD = []

  console.log(`📖 SEARCHING YUGIPEDIA FOR [[ ${card} ]]...`)
  try {
    let html = await fetch(`${process.env.SCRAPE_URL}/${USER_STRING}`)
    html = await html.text()
    let $ = cheerio.load(html)

    if (!$('.card-table').length) {
      html = await fetch(`${process.env.SCRAPE_URL}/${card}`)
      html = await html.text()
      $ = cheerio.load(html)

      if (!$('.card-table').length) return CARD
    }

    const heading = $('h1').text().trim().replace('Yugipedia', '')
    let name = $('.heading').text().trim()
    if (heading.includes('(Rush Duel)')) name += ' (Rush Duel)'
    const lore = $('.lore').text().trim()
    const tableClass = $('.card-table').attr('class')
    
    let type = $('.innertable tr:contains("Card type") td:nth-child(2)').text().trim()
    if ($('.token-card').length) type = "Token"
    
    let image = $('.cardtable-main_image-wrapper > a > img').attr('srcset')
    if (!image) image = $('.cardtable-main_image-wrapper > a > img').attr('src')
    else image = image.trim().split(' ')[0]

    let types = ""
    if (["Spell", "Trap"].includes(type)) {
      const property = $('.innertable tr:contains("Property") td:nth-child(2)').text().trim()
      
      CARD.push({ name, type, property, lore, image })
    } else if (type === "Skill" || tableClass.includes('skill')) {
      type = "Skill"
      types = $('.innertable tr:contains("Types") td:nth-child(2)')
      
      if (types.length) {
        types.text().trim()
        types = types.replace(/ \/ /g, '/')

        CARD.push({ name, type, types, lore, image })
      } else {
        CARD.push({ name, type, lore, image })
      }
    } else {
      if (tableClass.includes('token')) type = "Token"
      if (tableClass.includes('effect') || tableClass.includes('normal')) type = "Monster"

      const attribute = $('.innertable tr:contains("Attribute") td:nth-child(2)').text().trim()
      types = $('.innertable tr:contains("Types") td:nth-child(2)').text().trim()
      types = types.replace(/ \/ /g, '/')
      
      if (types.includes("Link")) {
        const [atk, linkRating] = $('.innertable tr:contains("ATK / LINK") td:nth-child(2)').text().trim().split(' / ')
        let linkArrows = $('.innertable tr:contains("Link Arrows") td:nth-child(2)').text().trim().split(',')
        linkArrows = linkArrows.map(arrow => arrow.trim())
        
        CARD.push({ name, type, attribute, types, linkArrows, atk, linkRating, lore, image })
      } else {
        const [atk, def] = $('.innertable tr:contains("ATK / DEF") td:nth-child(2)').text().trim().split(' / ')
        const level = $('.innertable tr:contains("Level") td:nth-child(2)').text().trim()
        
        if (types.includes("Pendulum")) {
          const scale = $('.innertable tr:contains("Pendulum Scale") td:nth-child(2)').text().trim()
          
          CARD.push({ name, type, attribute, types, level, scale, atk, def, lore, image })
        } else {
          CARD.push({ name, type, attribute, types, level, atk, def, lore, image })
        }
      }
    }
    
    const categoryList = $('#mw-normal-catlinks').text()
    let cardCategory
    if (categoryList.includes('Rush Duel cards'))
      cardCategory = 'rush'
    else if (categoryList.includes('TCG cards') || categoryList.includes('OCG cards'))
      cardCategory = 'ocg'
    else
      cardCategory = 'stray'

    CARD[0].category = cardCategory
    return CARD
  } catch (err) {
    console.log(`🔴 [[ ${card} ]] CARD CREATION ERROR:`, err.message)
    console.log("🔷 STACK:", err.stack)
    return CARD
  }
}

const updateCards = async () => {
  try {
    let ygoProDeckCards = await fetch(process.env.YGOPD_API)
    ygoProDeckCards = await ygoProDeckCards.json()
    ygoProDeckCards = ygoProDeckCards.data
      
    console.log("=====================================")
    console.log("DB CARD COUNT:", CARDS.length)
    console.log("YGOPRODECK CARD COUNT:", ygoProDeckCards.length)
    console.log("=====================================")

    if (YGOPDCOUNT === ygoProDeckCards.length)
      return console.log("👍  CARD DB IS UP TO DATE!")
    else YGOPDCOUNT = ygoProDeckCards.length

    await BotVariable.findOneAndUpdate(
      { name: 'YGOPRODeck' },
      { card_count: YGOPDCOUNT, last_update: new Date().toLocaleString('en-ph') }
    )
    
    let newCards = []
    if (ygoProDeckCards.length - CARDS.length) {
      console.log("❓ DATABASE MAY NEED UPDATE...")

      const cardstoIgnore = require('../data/cards-to-ignore.json')
      CARDS.forEach(card => cardstoIgnore.push(card.name))
      
      ygoProDeckCards.forEach(card => {
        if (!cardstoIgnore.includes(card.name)) {
          console.log("⭐ NEW CARD:", card.name)
          newCards.push(card)
        }
      })
    }

    if (!newCards.length) return console.log("❎ NO NEW CARDS FOUND.")

    const newCardsArray = newCards.map(card => createCard(card.name))
    let newYugipediaCards = await Promise.all(newCardsArray)
    newYugipediaCards = newYugipediaCards.reduce((acc, curr) => {
      if (curr.length) acc.push(curr[0])
      else acc.push(undefined)
      return acc
    }, [])
    
    newYugipediaCards.forEach((card, index) => {
      if (!card) {
        return console.log("🔴 YUGIPEDIA 404 PAGE ERROR:", newCards[index].name)
      } else {
        console.log("👑 YUGIPEDIA ENTRY FOUND:", newCards[index].name)
        card.lore = newCards[index].desc
        if (card.name === "") card.title = newCards[index].name
        CARDS.push(card)
        newCards[index] = card
      }
    })
    
    CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))
    console.log(`✅ NEW CARD(S) (${newCards.length}) ADDED!`)
    
    return addNewCardsToDb(newCards)
  } catch (err) {
    console.log("🔴 CARD DATABASE UPDATE ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
    return { error: err.message }
  }
}

const addNewCardsToDb = (cards) => {
  cards.forEach(async (card) => {
    try {
      const category = card.category
      delete card.category

      let savedCard
      if (category === 'ocg')
        savedCard = await new OcgCard(card).save()
      else if (category === 'rush')
        savedCard = await new RushCard(card).save()
      else
        savedCard = await new StrayCard(card).save()
  
      console.log(`💾 [[${savedCard.name}]] saved to MongoDb!`)
      CARDS.push(card)
      CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      console.log("🔴 NEW CARD SAVE ERROR:", err.message)
      console.log("🔷 STACK:", err.stack)
    }
  })
}





module.exports = {
  fetchAllData,
  normalizeString,
  getRandomCard,
  findClosestCard,
  updateCards
}