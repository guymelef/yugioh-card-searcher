const { LevenshteinDistanceSearch } = require('natural')
const { distance } = require("fastest-levenshtein")

const { requestOptions, getSymbol } = require('./bot_util')
const { fetchFromYugipedia } = require('./yugipedia_util')
const { OcgCard, RushCard, StrayCard, UnofficialCard } = require('../models/card')
const BotVariable = require('../models/variable')

let CARDS
let YGOPDCOUNT
let LAST_RANDOM_CARD
let YUGIPEDIA_LAST_UPDATE



const fetchAllData = async () => {
  try {
    const ocgCards = await OcgCard.find({}).select('-_id -__v').lean().exec()
    const rushCards = await RushCard.find({}).select('-_id -__v').lean().exec()
    const strayCards = await StrayCard.find({}).select('-_id -__v').lean().exec()
    const unofficialCards = await UnofficialCard.find({}).select('-_id -__v').lean().exec()
    CARDS = [...ocgCards, ...rushCards, ...strayCards, ...unofficialCards].sort((a, b) => a.name.localeCompare(b.name))
    console.log(`🟩 All [${CARDS.length.toLocaleString()}] cards fetched!`)

    const ygopdCount = await BotVariable.findOne({ name: 'YGOPRODeck' })
    YGOPDCOUNT = ygopdCount.card_count
    console.log(`🟩 YGOPD card count (${ygopdCount.last_update}): ${YGOPDCOUNT.toLocaleString()}`)

    const yugipediaVar = await BotVariable.findOne({ name: 'Yugipedia' })
    YUGIPEDIA_LAST_UPDATE = yugipediaVar.lastUpdate
    console.log(`🟩 YUGIPEDIA LATEST ENTRY: ${new Date(YUGIPEDIA_LAST_UPDATE).toLocaleString('en-ph')}`)
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
    .replace(/[^\w/@#.&]|_/g, "")
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
  let remoteMatches = []

  for (let index = 0; index < CARDS.length; index++) {
    let card = CARDS[index]
    const cardName = normalizeString(card.name)
    let cardNameArr = card.name.toLowerCase().split(' ')
    cardNameArr = cardNameArr.map(word => normalizeString(word))

    const levDistance = LevenshteinDistanceSearch(USER_KEYWORD.toLowerCase(), card.name.toLowerCase())
    delete levDistance.substring
    levDistance.index = index
    DISTANCEARRAY.push(levDistance)

    if (!bulk) {
      if (cardName === keyword ||
        keywordArr.join('') === cardNameArr.join('') ||
        (card?.alias && card.alias.toLowerCase() === keyword)
      ) {
        exactMatch.push(card)
        console.log("↪️  sending exact match...")
        return exactMatch
      }
    }
    
    if (card?.alias && card.alias.toLowerCase().includes(keyword)) {
      queryMatches.push(card)
      continue
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

          if (word === 'and') {
            if (cardName.includes('&')) {
              matches++
              closeMatches++
              continue
            }
          }

          if ([2, 3, 4].includes(word.length)) {
            let convertedStr = word.split('').join('.')
            if (cardName.includes(convertedStr)) {
              matches++
              closeMatches++
              continue
            }

            convertedStr = word.split('').join('/')
            if (cardName.includes(convertedStr)) {
              matches++
              closeMatches++
              continue
            }
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
        } else {
          if (closeMatches === keywordArr.length) {
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
          
          if (keywordArr.length > 1 && keyword.length >= 10) {
            if (distance(cardName, keyword) < 4) {
              possibleMatches.push(card)
              continue
            }

            if (distance(keyword, cardName.slice(0, keyword.length)) < 4) {
              possibleMatches.push(card)
              continue
            }
          }

          if (!possibleMatches.length) {
            if (keywordArr.length === 2 && matches === 1) partialMatches.push(card)
            else if (keywordArr.length > 2 && matches / keywordArr.length > 0.6) partialMatches.push(card)
          }
        }
      }
    }
  }

  if (!queryMatches.length || !keywordMatches.length || !possibleMatches.length || !partialMatches.length) {
    const min = Math.min(...DISTANCEARRAY.map(item => item.distance))
    const minArray = DISTANCEARRAY.filter(item => item.distance === min)
    minArray.forEach(item => remoteMatches.push(CARDS[item.index]))
  }
  
  if (bulk) {
    if (queryMatches.length) {
      console.log(`↪️  sending [${queryMatches.length}] query matches...`)
      return queryMatches
    } 
    
    if (keywordMatches.length) {
      console.log(`↪️  sending [${keywordMatches.length}] keyword matches...`)
      return keywordMatches
    }
    
    if (possibleMatches.length) {
      console.log(`↪️  sending [${possibleMatches.length}] possible matches...`)
      return possibleMatches
    }
    
    if (partialMatches.length) {
      console.log(`↪️  sending [${partialMatches.length}] partial matches...`)
      return partialMatches
    }

    console.log(`↪️  sending [${remoteMatches.length}] remote matches...`)
    return remoteMatches
  } else {
    if (queryMatches.length) {
      console.log(`↪️  sending [${queryMatches.length}] query matches...`)
      return queryMatches
    }

    if (keywordMatches.length) {
      console.log(`↪️  sending [${keywordMatches.length}] keyword matches...`)
      return keywordMatches
    }

    const yugipediaCard = await fetchFromYugipedia(USER_KEYWORD, null, null)
    if (yugipediaCard.length) {
      addNewCardsToDb(yugipediaCard)
      return yugipediaCard
    }

    if (possibleMatches.length) {
      console.log(`↪️  sending [${possibleMatches.length}] possible matches...`)
      return possibleMatches
    }

    if (partialMatches.length) {
      console.log(`↪️  sending [${partialMatches.length}] partial matches...`)
      return partialMatches
    }

    console.log(`↪️  sending [${remoteMatches.length}] remote matches...`)
    return remoteMatches
  }
}

const findClosestNaturalCard = (source, cards) => {
  source = source.toLowerCase()

  const distanceArr = cards.map(card => {
    let distance = LevenshteinDistanceSearch(source, card.name.toLowerCase())
    distance.name = card.name
    
    let symbol
    if (card.type === "Monster") symbol = getSymbol(null, card.types)
    else symbol = getSymbol(card.type)
  
    distance.symbol = symbol
    return distance
  })

  const min = Math.min(...distanceArr.map(item => item.distance))
  let closest = distanceArr.filter(item => item.distance === min)
  
  if (closest.length > 1) {
    closest.sort((a, b) => {
      if (a.distance === b.distance) return a.offset - b.offset
      return a.distance - b.distance
    })
  }
  
  closest = closest[0]

  return `${closest.symbol}${closest.name}`
}

const checkForNewYgopdCards = async () => {
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
    
    console.log("❓ DATABASE MAY NEED UPDATE...")
    let newCards = []
    const cardstoIgnore = require('../data/cards-to-ignore.json')
    CARDS.forEach(card => cardstoIgnore.push(card.name))
    
    ygoProDeckCards.forEach(card => {
      if (!cardstoIgnore.includes(card.name)) {
        newCards.push(card.name)
      }
    })

    if (!newCards.length) return console.log("❎ NO NEW CARDS FOUND.")

    newCards = await fetchFromYugipedia(null, null, newCards)
    return addNewCardsToDb(newCards)
  } catch (err) {
    console.log("🔴 CARD DATABASE UPDATE ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const checkForNewYugipediaCards = async () => {
  try {
    const recentChanges = await fetch(`${process.env.YUGIPEDIA_RC}${YUGIPEDIA_LAST_UPDATE}`, requestOptions)
    let rc = await recentChanges.json()
    rc = rc.query.recentchanges
  
    console.log('******************************************************')
    console.log('LAST YUGIPEDIA CARD CREATED:', new Date(YUGIPEDIA_LAST_UPDATE).toLocaleString('en-ph'))
    console.log('MOST RECENT CHANGE (NEW):', new Date(rc[0].timestamp).toLocaleString('en-ph'))
    console.log('******************************************************')
  
    let newCardPages = rc.filter(item => {
      const comment = item.comment.toLowerCase()
      if (comment.includes('{{cardtable2') && item.timestamp !== YUGIPEDIA_LAST_UPDATE) return item
    })
  
    if (newCardPages.length) {
      console.log(`📢 [${newCardPages.length}] NEW YUGIPEDIA CARD(S) FOUND!`)
      
      YUGIPEDIA_LAST_UPDATE = newCardPages[0].timestamp
  
      await BotVariable.findOneAndUpdate(
        { name: "Yugipedia" },
        { lastUpdate: YUGIPEDIA_LAST_UPDATE,
          lastCard: { 
            title: newCardPages[0].title, 
            pageid: newCardPages[0].pageid 
          }
        }
      )
      
      newCardPages = newCardPages.map(page => page.pageid)
      const newCards = await fetchFromYugipedia(null, newCardPages, null)
  
      return addNewCardsToDb(newCards)
    }
  
    return console.log("👍  CARD DB IS UP TO DATE!")
  } catch (err) {
    console.log("🔴 YUGIPEDIA RC CHECK ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const addNewCardsToDb = async (cards) => {
  const models = { "stray": StrayCard, "ocg": OcgCard, "rush": RushCard, "unofficial": UnofficialCard }
  let category
  let official

  for (let card of cards) {
    try {
      category = card.category
      official = card.official
      delete card.official

      console.log(`📁 SAVING "${card.name}"...`)
      let savedCard
      if (category === 'stray') savedCard = await new StrayCard(card).save()
      else if (official) savedCard = await new models[category](card).save()
      else savedCard = await new UnofficialCard(card).save()

      CARDS.push(card)
      console.log(`💾 《 "${savedCard.name}" 》/${category.toUpperCase()} (${official ? 'official' : 'unofficial'})/ saved to MongoDb!`)
      console.log(card)
    } catch (err) {
      if (err.name === "ValidationError") {
        console.log("❗ CARD ALREADY EXISTS...")
        
        if (!official) category = 'unofficial'
        if (card.alias) {
          await models[category].findOneAndUpdate(
            { name: card.name },
            { alias: card.alias }
          )
          console.log(`⭐ "${card.name}" (${card.alias}) updated!`)

          CARDS = CARDS.map(item => {
            if (item.name === card.name) {
              item = card
              return item
            } else {
              return item
            }
          })
        }

        continue
      } else {
        console.log("🔴 NEW CARD SAVE ERROR:", err.message)
        console.log("🔷 STACK:", err.stack)
      }
    }
  }

  CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))
}





module.exports = {
  fetchAllData,
  normalizeString,
  getRandomCard,
  findClosestCard,
  findClosestNaturalCard,
  checkForNewYgopdCards,
  checkForNewYugipediaCards
}