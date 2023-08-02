const { distance } = require("fastest-levenshtein")



const CARDS = require('../data/cards.json')
const CARDNAMES = CARDS.map((item, index) => ({ name: normalizeString(item.name), index }))

const getRandomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)]

function normalizeString(str) {
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-★☆]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w/@#.]|_/g, "")
    .toLowerCase()
}

const findClosestCard = (str) => {
  const strArr = str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-★☆]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/@#.]|_/g, "")
    .toLowerCase()
    .trim()
    .split(' ')
  str = normalizeString(str)
  const DISTANCEARRAY = []

  console.log(`🚀 SEARCHING FOR: "${str}"...`)

  let exactMatch = []
  let firstMatch = []
  let partialMatches = []
  let keywordMatches = []
  let possibleMatch = []
  let remoteMatch = []

  for (let card of CARDNAMES) {
    const name = card.name

    if (name === str) {
      exactMatch.push(CARDS[card.index])
      return exactMatch
    }

    if (strArr.length === 1) {
      if (distance(strArr[0], name.slice(0, strArr[0].length)) === 1) possibleMatch.push(CARDS[card.index])

      const nameArr = CARDS[card.index].name.toLowerCase().split(' ')
      for (let i = 0; i < nameArr.length; i++) {
        if (distance(nameArr[i], str) === 1) {
          possibleMatch.push(CARDS[card.index])
          break
        }
      }
    }

    if (distance(name, str) === (name.length - str.length))
      if (name.slice(0, strArr[0].length) === strArr[0]) partialMatches.push(CARDS[card.index])

    if (name.includes(str)) {
      if (!firstMatch.length && name.startsWith(str)) firstMatch.push(CARDS[card.index])
      keywordMatches.push(CARDS[card.index])
    }

    DISTANCEARRAY.push(distance(name, str))
  }

  if (firstMatch.length) return firstMatch

  if (keywordMatches.length === 1) return keywordMatches

  if (partialMatches.length || keywordMatches.length) {
    if (partialMatches.length > keywordMatches.length) return partialMatches
    return keywordMatches
  }

  if (possibleMatch.length) return possibleMatch

  if (!exactMatch.length && !partialMatches.length && !keywordMatches.length) {
    const min = Math.min(...DISTANCEARRAY)
    
    if (min === str.length) return []

    const minArray = []
    DISTANCEARRAY.forEach((num, index) => { if (num === min) minArray.push(index) })
    for (let index of minArray) {
      if (CARDNAMES[index].name[0] === str[0]) {
        remoteMatch.push(CARDS[index])
        break
      }
    }
    if (remoteMatch.length) return remoteMatch
  }
  return remoteMatch
}

const filterCardsbyKeyword = (keyword) => {
  const strArr = keyword
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-★☆]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/@#.]|_/g, "")
    .toLowerCase()
    .trim()
    .split(' ')
  keyword = normalizeString(keyword)

  console.log(`🚀 SEARCHING LIST FOR: "${keyword}"...`)
  
  const keywordMatches = []
  const partialMatches = []
  const possibleMatches = []
  
  CARDS.forEach(card => {
    const name = normalizeString(card.name)
    
    if (name.includes(keyword)) keywordMatches.push(card)

    if (distance(name, keyword) === (name.length - keyword.length)) {
      if (name.slice(0, strArr[0].length) === strArr[0]) return partialMatches.push(card)
    }

    if (strArr.length === 1) {
      if (distance(strArr[0], name.slice(0, strArr[0].length)) === 1) possibleMatches.push(card)

      const nameArr = card.name.toLowerCase().split(' ')
      for (let i = 0; i < nameArr.length; i++) {
        if (distance(nameArr[i], keyword) === 1) return possibleMatches.push(card)
      }
    }
  })

  let searchResult = []
  if (keywordMatches.length && partialMatches.length) {
    searchResult = keywordMatches.concat(partialMatches)
    searchResult = searchResult.filter((value, index, self) => self.indexOf(value) == index)
  } else if (keywordMatches.length) searchResult = keywordMatches
  else if (partialMatches.length) searchResult = partialMatches
  else if (possibleMatches.length) searchResult = possibleMatches

  return searchResult
}





module.exports = {
  findClosestCard,
  filterCardsbyKeyword,
  getRandomCard,
  normalizeString
}