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
    .replace(/[^\w/@#.]/g, "")
    .toLowerCase()
}

const findClosestCard = (str) => {
  const strArr = str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-★☆]/g, " ")
    .replace(/[^\w\s/@#]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim()
    .split(' ')
  str = normalizeString(str)
  const DISTANCEARRAY = []

  console.log(`🔎 SEARCHING FOR: "${str}"...`)

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
  keyword = normalizeString(keyword)

  console.log(`🔎 SEARCHING FOR: "${keyword}"...`)
  
  return CARDS.filter(card => {
    const name = normalizeString(card.name)
    
    if (name.includes(keyword)) return card

    if (distance(name, keyword) === (name.length - keyword.length)) {
      const strArr = keyword.split(' ')
      if (name.slice(0, strArr[0].length) === strArr[0]) return card
    }

    const keywordArr = keyword.split(' ')
    if (keywordArr.length === 1) {
      const nameArr = card.name.toLowerCase().split(' ')
      for (let i = 0; i < nameArr.length; i++) {
        if (distance(nameArr[i], keyword) === 1) return card
      }
    }
  })
}





module.exports = {
  findClosestCard,
  filterCardsbyKeyword,
  getRandomCard,
  normalizeString
}