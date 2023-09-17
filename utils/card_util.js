const { LevenshteinDistanceSearch } = require('natural')
const { distance } = require("fastest-levenshtein")

const { getSymbol } = require('./bot_util')
const { fetchFromYugipedia } = require('./yugipedia_util')
const { OcgCard, RushCard, StrayCard } = require('../models/card')
const BotVariable = require('../models/variable')

let CARDS
let LAST_RANDOM_CARD
let YUGIPEDIA_LAST_SEARCH



const fetchAllData = async () => {
  try {
    const ocgCards = await OcgCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    const rushCards = await RushCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    const strayCards = await StrayCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    CARDS = [...ocgCards, ...rushCards, ...strayCards].sort((a, b) => a.name.localeCompare(b.name))
    console.log(`🟩 All [${CARDS.length.toLocaleString('en-ph')}] cards fetched!`)

    const ygopdCount = await BotVariable.findOne({ name: 'YGOPRODeck' })
    console.log(`🟩 YGOPD card count (${ygopdCount.last_update}): ${ygopdCount.card_count.toLocaleString('en-ph')}`)

    const yugipediaVar = await BotVariable.findOne({ name: 'Yugipedia' })
    YUGIPEDIA_LAST_SEARCH = yugipediaVar.lastSearch
    console.log(`🟩 YUGIPEDIA LATEST ENTRY: ${new Date(yugipediaVar.lastUpdate).toLocaleString('en-ph')}`)
    console.log(`🟩 YUGIPEDIA LAST SEARCH: ${new Date(YUGIPEDIA_LAST_SEARCH).toLocaleString('en-ph')}`)
  } catch (err) {
    console.log("🔴 CARDS FETCH ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const getRandomCard = () => {
  const index = Math.floor(Math.random() * CARDS.length)
  const card = CARDS[index]
  
  if (LAST_RANDOM_CARD === card.name) return getRandomCard()
  else LAST_RANDOM_CARD = card.name

  return card
}

const normalizeString = (string) => {
  return string
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\s\w:!/@&?#=%]|[_☆★]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const findClosestCard = async (keyword, bulk = false) => {
  const keywordArr = keyword.split(' ')
  
  const DISTANCEARRAY = []

  let exactMatch = []
  let queryMatches = []
  let wordMatches = []
  let possibleMatches = []
  let partialMatches = []
  let remoteMatches = []

  const convertedStringChecker = (word, cardName) => {
    let convertedStr = word.split('').join('.')
    if (cardName.includes(convertedStr)) return true

    convertedStr = word.split('').join('/')
    if (cardName.includes(convertedStr)) return true

    convertedStr = word.split('').join(':')
    if (cardName.includes(convertedStr)) return true

    return false
  }

  for (let index = 0; index < CARDS.length; index++) {
    let card = CARDS[index]
    const cardName = normalizeString(card.name)
    const cardNameArr = cardName.split(' ')

    const levDistance = LevenshteinDistanceSearch(keyword, cardName)
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

    if ([2, 3, 4].includes(keyword.length)) {
      if (convertedStringChecker(keyword, cardName)) {
        queryMatches.push(card)
        continue
      }
    }

    if (!queryMatches.length) {
      if (cardNameArr.join('').includes(keywordArr.join(''))) {
        wordMatches.push(card)
        continue
      }

      if (keywordArr.length > 1 && cardNameArr.length > 1) {
        let isAMatch = false
        let matches = 0
        for (let word of keywordArr) {
          if (cardName.includes(word)) {
            isAMatch = true
            matches++
            continue
          }

          if (word === 'and' && cardName.includes('&')) {
            isAMatch = true
            matches++
            continue
          }

          if ([2, 3, 4].includes(word.length)) {
            if (convertedStringChecker(word, cardName)) {
              isAMatch = true
              matches++
              continue
            }
          }

          if (!isAMatch) break
        }
  
        if (isAMatch && matches === keywordArr.length) {
          wordMatches.push(card)
          continue
        }
      }
    }

    if (!wordMatches.length) {
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
        let closeMatches = 0
        if (keywordArr.length > 1 && cardNameArr.length > 1) {
          for (let word of keywordArr) {
            if (cardName.includes(word)) {
              closeMatches++
              continue
            }

            if (word.length > 3) {
              for (let string of cardNameArr) {
                if (string.length > 3 && distance(string, word) < 3) {
                  closeMatches++
                  break
                }
              }
            }
          }

          if (closeMatches === keywordArr.length) {
            possibleMatches.push(card)
            continue
          }
        }

        if (keywordArr.length === 2) {
          let possibleMatch = false
          for (let word of cardNameArr) {
            if (word.length > 3 && distance(word, keywordArr.join('')) < 3) {
              possibleMatch = true
              possibleMatches.push(card)
              break
            }
          }
          if (possibleMatch) continue
        }
        
        if (keywordArr.length > 1 && keyword.length >= 10) {
          const cardNameJoined = cardNameArr.join('')
          const keywordJoined = keywordArr.join('')
          
          if (distance(cardNameJoined, keywordJoined) < 4) {
            possibleMatches.push(card)
            continue
          }

          if (distance(cardNameJoined.slice(0, keywordJoined.length), keywordJoined) < 4) {
            possibleMatches.push(card)
            continue
          }
        }

        if (!possibleMatches.length) {
          if (keywordArr.length === 2 && closeMatches === 1) partialMatches.push(card)
          else if (keywordArr.length > 2 && closeMatches / keywordArr.length >= 0.6) partialMatches.push(card)
        }
      }
    }
  }

  if (!queryMatches.length || !wordMatches.length || !possibleMatches.length || !partialMatches.length) {
    const min = Math.min(...DISTANCEARRAY.map(item => item.distance))
    const minArray = DISTANCEARRAY.filter(item => item.distance === min)
    minArray.forEach(item => remoteMatches.push(CARDS[item.index]))
  }
  
  if (bulk) {
    if (queryMatches.length) {
      console.log(`↪️  sending [${queryMatches.length}] query matches...`)
      return queryMatches
    } 
    
    if (wordMatches.length) {
      console.log(`↪️  sending [${wordMatches.length}] word matches...`)
      return wordMatches
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

    if (wordMatches.length) {
      console.log(`↪️  sending [${wordMatches.length}] word matches...`)
      return wordMatches
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

const searchYugipedia = async (keyword) => {
  const newDate = new Date()
  const timeDiff = (newDate - new Date(YUGIPEDIA_LAST_SEARCH)) / 1000

  if (timeDiff >= 1) {
    YUGIPEDIA_LAST_SEARCH = newDate.toISOString()
    await BotVariable.findOneAndUpdate({ name: 'Yugipedia' }, { lastSearch: YUGIPEDIA_LAST_SEARCH })
    const yugipediaCard = await fetchFromYugipedia(keyword)

    if (yugipediaCard.length) saveToDatabase(yugipediaCard[0])
  
    console.log(`↪️  sending [${yugipediaCard.length}] search result...`)
    return yugipediaCard
  }
  
  return false
}

const saveToDatabase = async (card) => {
  const models = { "stray": StrayCard, "ocg": OcgCard, "rush": RushCard }
  const CardModel = models[card.category]

  try {
    const category = card.category
    const official = card.official
    delete card.category

    console.log(`📁 SAVING "${card.name}"...`)
    const savedCard = await new CardModel(card).save()

    CARDS.push(card)
    CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))
    console.log(`💾 《 "${savedCard.name}" 》/${category.toUpperCase()} (${official ? 'official' : 'unofficial'})/ saved to MongoDb!`)
    console.log(card)
  } catch (err) {
    if (err.name === "ValidationError") {      
      if (card.official) delete card.official
      await CardModel.findOneAndReplace({ name: card.name }, card)
      console.log("♻️ CARD REPLACED IN DATABASE!")
      
      delete card.official
      delete card.pageId
      const index = CARDS.findIndex(item => item.name === card.name)
      CARDS[index] = card
    } else {
      console.log("🔴 NEW CARD SAVE ERROR:", err.message)
      console.log("🔷 STACK:", err.stack)
    }
  }
}





module.exports = {
  fetchAllData,
  normalizeString,
  getRandomCard,
  findClosestCard,
  findClosestNaturalCard,
  searchYugipedia
}