const { distance } = require("fastest-levenshtein")
const { LevenshteinDistanceSearch } = require('natural')

const { SEARCHER_API, searchOptions } = require('../config/config')
const BotVariable = require('../models/variable')
const { OcgCard, RushCard, StrayCard } = require('../models/card')
const { getSymbol } = require('./card')
const { fetchFromYugipedia } = require('./yugipedia')



let MAIN_CARDS
let RUSH_CARDS
let LAST_RANDOM_CARD
let YUGIPEDIA_LAST_SEARCH

const fetchAllData = async () => {
  try {
    const ocgCards = await OcgCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    const rushCards = await RushCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    const strayCards = await StrayCard.find({}).select('-pageId -official -_id -__v').lean().exec()
    MAIN_CARDS = [...ocgCards, ...strayCards].sort((a, b) => a.name.localeCompare(b.name))
    RUSH_CARDS = [...rushCards].sort((a, b) => a.name.localeCompare(b.name))
    console.log(`💠 MAIN CARDS: ${ocgCards.length.toLocaleString('en-ph')}`)
    console.log(`💠 RUSH CARDS: ${rushCards.length.toLocaleString('en-ph')}`)
    console.log(`💠 STRAY CARDS: ${strayCards.length.toLocaleString('en-ph')}`)

    const ygopdVar = await BotVariable.findOne({ name: 'YGOPRODeck' })
    console.log(`⭐ YGOPD CARD COUNT (${ygopdVar.last_update}): ${ygopdVar.card_count.toLocaleString('en-ph')}`)
    const yugipediaVar = await BotVariable.findOne({ name: 'Yugipedia' })
    YUGIPEDIA_LAST_SEARCH = yugipediaVar.lastSearch
    console.log(`⭐ YUGIPEDIA LATEST ENTRY: ${new Date(yugipediaVar.lastUpdate).toLocaleString('en-ph')}`)
    console.log(`⭐ YUGIPEDIA LAST SEARCH: ${new Date(YUGIPEDIA_LAST_SEARCH).toLocaleString('en-ph')}`)
  } catch (err) {
    console.log("🟥 CARDS FETCH ERROR:", err.message)
    console.log("🔷 STACK:", err.stack)
  }
}

const getRandomCard = (pool) => {
  const CARDS = (pool === 'main') ? MAIN_CARDS : RUSH_CARDS
  const index = Math.floor(Math.random() * CARDS.length)
  const card = CARDS[index]

  if (LAST_RANDOM_CARD === card.name) return getRandomCard()
  else LAST_RANDOM_CARD = card.name

  console.log('↪️ sent random card\n')
  return card
}

const normalizeString = (string) => {
  return string
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\s\w:!/@&?#=%\[\]]|[_☆★]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const findClosestCard = async (keyword, bulk, pool) => {
  const USER_KEYWORD = keyword
  keyword = normalizeString(keyword)
  const keywordArr = keyword.split(' ')
  const CARDS = (pool === 'main') ? MAIN_CARDS : RUSH_CARDS

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

  const getTopPartialMatches = () => {
    if (partialMatches.length <= 10) {
      return partialMatches
    } else {
      const distanceArr = partialMatches.map(card => {
        let value = LevenshteinDistanceSearch(keyword, card.name.toLowerCase())
        value.card = card
        return value
      })
      
      distanceArr.sort((a, b) => a.distance - b.distance)
      partialMatches = distanceArr.map(({ card }) => card).slice(0, 12)
      return partialMatches
    }
  }
  
  const DISTANCEARRAY = []
  for (let index = 0; index < CARDS.length; index++) {
    let card = CARDS[index]
    const cardName = normalizeString(card.name)
    const cardNameArr = cardName.split(' ')

    if (!queryMatches.length && !wordMatches.length && !possibleMatches.length && !partialMatches.length) {
      const levDistance = LevenshteinDistanceSearch(keyword, cardName)
      levDistance.index = index
      DISTANCEARRAY.push(levDistance)
    }

    if (!bulk) {
      if (cardName === keyword ||
        keywordArr.join('') === cardNameArr.join('') ||
        (card?.alias && card.alias.toLowerCase() === keyword)
      ) {
        exactMatch.push(card)
        console.log("↪️ found exact match\n")
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

      if (cardNameArr.join('').includes(keywordArr.join(''))) {
        possibleMatches.push(card)
        continue
      }
    }

    if (!queryMatches.length && !wordMatches.length) {
      if ((keywordArr.length > 1 || keyword.length > 4) && distance(cardName, keyword) === 1 && !bulk) {
        console.log(`↪️ found closest match\n`)
        return [card]
      }

      if (cardName.length > 4 && keyword.includes(cardName)) {
        possibleMatches.push(card)
        continue
      }

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
        let longestWord = 0
        if (keywordArr.length > 1 && cardNameArr.length > 1) {
          for (let word of keywordArr) {
            if (cardName.includes(word)) {
              if (word.length > longestWord) longestWord = word.length
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

        if (keyword.length > 10 && distance(keywordArr.join(''), cardNameArr.join('')) < 4) {
          possibleMatches.push(card)
          continue
        }

        if (!possibleMatches.length) {
          if (closeMatches / keywordArr.length === 0.5) partialMatches.push(card)
          else if (closeMatches && longestWord > 4) partialMatches.push(card)
        }
      }
    }
  }

  if (!queryMatches.length && !wordMatches.length && !possibleMatches.length && !partialMatches.length) {
    const min = Math.min(...DISTANCEARRAY.map(item => item.distance))
    const minArray = DISTANCEARRAY.filter(item => item.distance === min)
    minArray.forEach(item => {
      const card = CARDS[item.index]
      if (card.name.toLowerCase().startsWith(keyword[0])) remoteMatches.push(CARDS[item.index])
    })
  }

  if (bulk) {
    if (queryMatches.length) {
      console.log(`↪️ found [${queryMatches.length}] query match(es)\n`)
      return queryMatches
    } 

    if (wordMatches.length) {
      console.log(`↪️ found [${wordMatches.length}] word match(es)\n`)
      return wordMatches
    }

    if (possibleMatches.length) {
      console.log(`↪️ found [${possibleMatches.length}] possible match(es)\n`)
      return possibleMatches
    }

    if (partialMatches.length) {
      console.log(`↪️ found [${partialMatches.length}] partial match(es)\n`)
      return getTopPartialMatches()
    }

    console.log(`↪️ found [${remoteMatches.length}] remote match(es)\n`)
    return remoteMatches
  } else {
    if (queryMatches.length) {
      console.log(`↪️ found [${queryMatches.length}] query match(es)\n`)
      return queryMatches
    }

    if (wordMatches.length) {
      console.log(`↪️ found [${wordMatches.length}] word match(es)\n`)
      return wordMatches
    }

    searchUsingUpdater(USER_KEYWORD)

    if (possibleMatches.length) {
      console.log(`↪️ found [${possibleMatches.length}] possible match(es)\n`)
      return possibleMatches
    }

    if (partialMatches.length) {
      console.log(`↪️ found [${partialMatches.length}] partial match(es)\n`)
      return getTopPartialMatches()
    }

    console.log(`↪️ found [${remoteMatches.length}] remote match(es)\n`)
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

    if (yugipediaCard.length) saveToDatabase({ ...yugipediaCard[0] })

    console.log(`↪️ found [${yugipediaCard.length}] search result...`)
    return yugipediaCard
  }

  return false
}

const searchUsingUpdater = async (cardName) => {
  try {
    console.log('🦊 SEARCHING VIA UPDATER API...')
    searchOptions.body = JSON.stringify({ card: cardName })
    let data = await fetch(SEARCHER_API, searchOptions)
    data = await data.json()

    if (data.match) {
      console.log(`💡 YUGIPEDIA MATCH FOUND FOR: "${cardName}"`)
      updateCardPool(data.card)
    } else {
      console.log(`\n👻 NO YUGIPEDIA MATCH FOUND FOR: "${cardName}"\n`)
    }
  } catch(err) {
    console.log('🟥 SEARCH API ERROR:', err)
  }
}

const saveToDatabase = async (card) => {
  const CARD = { ...card }
  const models = { "stray": StrayCard, "ocg": OcgCard, "rush": RushCard }
  const CardModel = models[card.category]

  try {
    const category = card.category
    const official = card.official
    if (card.official) delete card.official
    if (!card.legend) delete card.legend
    delete card.category

    console.log(`📁 SAVING "${card.name}"...`)
    const savedCard = await new CardModel(card).save()
    console.log(`💾 《 "${savedCard.name}" 》/${category.toUpperCase()} (${official ? 'official' : 'unofficial'})/ saved to MongoDb!`)
    console.log(card)

    updateCardPool(CARD)
  } catch (err) {
    if (err.name === "ValidationError") {
      await CardModel.findOneAndReplace({ name: card.name }, card)
      console.log("♻️ CARD REPLACED IN DATABASE!")

      updateCardPool(CARD)
    } else {
      console.log("🟥 NEW CARD SAVE ERROR:", err.message)
      console.log("🔷 STACK:", err.stack)
    }
  }
}

const updateCardPool = (card) => {
  const CARD_POOL = card.category === 'rush' ? RUSH_CARDS : MAIN_CARDS

  delete card.pageId
  delete card.official
  delete card.category

  const indexToReplace = CARD_POOL.findIndex(item => item.name === card.name)
  if (indexToReplace !== -1) {
    CARD_POOL[indexToReplace] = card
  } else {
    CARD_POOL.push(card)
    CARD_POOL.sort((a, b) => a.name.localeCompare(b.name))
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