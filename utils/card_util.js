const { distance } = require("fastest-levenshtein")
const CARDS = require('../data/cards.json')



const getRandomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)]

function normalizeString(string) {
  return string
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[★☆\s+]/g, "")
    .replace(/[^\w/@#.]|_/g, "")
}

const findClosestCard = (keyword, bulk = false) => {
  let keywordArr = keyword.toLowerCase().trim().replace(/\s+/g, " ").split(' ')
  keywordArr = keywordArr.map(word => normalizeString(word))
  keyword = normalizeString(keyword)
  const DISTANCEARRAY = []

  let exactMatch = []
  let firstMatch = []
  let partialMatches = []
  let keywordMatches = []
  let possibleMatches = []
  let possibleMatchesWithDistance3 = []
  let possibleMatchesWithDistance4 = []
  let remoteMatch = []

  for (let card of CARDS) {
    const cardName = normalizeString(card.name)
    let cardNameArr = card.name.toLowerCase().split(' ')
    cardNameArr = cardNameArr.map(word => normalizeString(word))

    if (cardName === keyword && !bulk) {
      exactMatch.push(card)
      console.log("🚩 sending exact match...")
      return exactMatch
    }

    if (keywordArr.length === 1) {
      if (distance(keywordArr[0], cardName.slice(0, keywordArr[0].length)) == 1) possibleMatches.push(card)

      for (let word of cardNameArr) {
        const distanceLength = distance(word, keyword)
        if (distanceLength < 3) {
          if (word.startsWith(keyword[0])) possibleMatches.push(card)
          break
        }
        
        if (distanceLength === 3) {
          if (word.startsWith(keyword[0])) possibleMatchesWithDistance3.push(card)
          break
        }

        if (distanceLength === 4) {
          if (word.startsWith(keyword[0])) possibleMatchesWithDistance4.push(card)
          break
        }
      }
    }

    if (keywordArr.length > 1) {
      const matchAllCheck = (card, strArr) => strArr.reduce((acc, word) => {
        if (!acc) return false
        if (card.includes(word)) return true
        return false
      }, true)
      
      if (matchAllCheck(cardName, keywordArr)) partialMatches.push(card)

      if (cardNameArr.length > 1) if (matchAllCheck(keyword, cardNameArr)) partialMatches.push(card)
    }

    if (cardName.includes(keyword)) {
      if (!firstMatch.length && cardName.startsWith(keyword)) firstMatch.push(card)
      keywordMatches.push(card)
    }

    DISTANCEARRAY.push(distance(cardName, keyword))
  }

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

  if (bulk) {
    if (keywordMatches.length && partialMatches.length) {
      let searchResult = []
      searchResult = keywordMatches.concat(partialMatches)
      searchResult = searchResult.filter((value, index, self) => self.indexOf(value) == index)
      
      console.log("🚩 sending keyword + partial matches...")
      return searchResult
    } else if (keywordMatches.length) {
      console.log("🚩 sending keyword matches...")
      return keywordMatches
    } else if (partialMatches.length) {
      console.log("🚩 sending partial matches...")
      return partialMatches
    } else if (possibleMatches.length || possibleMatchesWithDistance3.length || possibleMatchesWithDistance4.length) {
      console.log("🚩 sending possible matches...")
      if (possibleMatches.length) return possibleMatches
      if (possibleMatchesWithDistance3.length) return possibleMatchesWithDistance3
      if (possibleMatchesWithDistance4.length) return possibleMatchesWithDistance4
    } else {
      if (remoteMatch.length) {
        console.log("🚩 sending matches based on 1st remote match...")
        return CARDS.filter(card => card.name.includes(remoteMatch[0].name))
      }

      console.log("🚩 sending remote match...")
      return remoteMatch
    }
  } else {
    if (firstMatch.length) {
      console.log("🚩 sending first match...")
      return firstMatch
    }

    if (keywordMatches.length) {
      console.log("🚩 sending keyword matches...")
      return keywordMatches
    }

    if (partialMatches.length) {
      console.log("🚩 sending partial matches...")
      return partialMatches
    }

    if (possibleMatches.length || possibleMatchesWithDistance3.length || possibleMatchesWithDistance4.length) {
      console.log("🚩 sending possible matches...")

      if (possibleMatches.length) return possibleMatches
      if (possibleMatchesWithDistance3.length) return possibleMatchesWithDistance3
      if (possibleMatchesWithDistance4.length) return possibleMatchesWithDistance4
    }

    console.log("🚩 sending remote match...")
    return remoteMatch
  }
}





module.exports = {
  normalizeString,
  getRandomCard,
  findClosestCard
}