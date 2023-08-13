require('dotenv').config()
const { distance } = require("fastest-levenshtein")
const cheerio = require('cheerio')
let CARDS = [...require('../data/tcg-ocg.json'), ...require('../data/rush-duel.json')]
CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))



const normalizeString = (string) => string
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[★☆\s+]/g, "")
  .replace(/[^\w/@#.]|_/g, "")

const getRandomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)]

const findClosestCard = async (keyword, bulk = false) => {
  const USER_KEYWORD = keyword
  let keywordArr = keyword.toLowerCase().trim().replace(/\s+/g, " ").split(' ')
  keywordArr = keywordArr.map(word => normalizeString(word))
  keyword = normalizeString(keyword)
  const DISTANCEARRAY = []

  let exactMatch = []
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
      console.log("🚩 sending exact match...")
      return exactMatch
    }
    
    if (cardName.includes(keyword)) {
      keywordMatches.push(card)
      continue
    }

    const matches = keywordArr.reduce((sum, word) => {
      if (cardName.includes(word)) sum++
      return sum
    }, 0)

    if (matches === keywordArr.length) {
      keywordMatches.push(card)
      continue
    }

    if (distance(cardName, keyword) < 4 && keywordArr.length > 1) {
      possibleMatches.push(card)
      continue
    }
    
    if (keywordArr.length === 1) {
      if (keyword.length > 3) {
        if (distance(keywordArr[0], cardName.slice(0, keywordArr[0].length)) < 2) possibleMatches.push(card)
  
        for (let word of cardNameArr) {
          const distanceLength = distance(word, keyword)
          if (distanceLength < 3 && word.length > 3 && word.startsWith(keyword[0])) {
            if (word.startsWith(keyword[0])) possibleMatches.push(card)
            break
          }
        }
      }
    }

    if (keywordArr.length > 1) {
      if (distance(keyword, cardName.slice(0, keyword.length)) < 3) {
        possibleMatches.push(card)
        continue
      }

      const matchAllCheck = (str, strArr) => strArr.reduce((acc, word) => {
        if (!acc) return false
        if (str.includes(word)) return true
        return false
      }, true)
      
      if (matchAllCheck(cardName, keywordArr)) {
        keywordMatches.push(card)
        continue
      }

      if (cardNameArr.length > 1) {
        if (matchAllCheck(keyword, cardNameArr) && cardName.length >= keyword.length) {
          keywordMatches.push(card)
          continue
        }
      }

      if (keywordArr.length === 2 && matches === 1) partialMatches.push(card)
      else if (keywordArr.length > 2 && matches / keywordArr.length > 0.6) partialMatches.push(card)
    }
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
    if (keywordMatches.length) {
      console.log("🚩 sending keyword matches...")
      return keywordMatches
    } else if (possibleMatches.length) {
      console.log("🚩 sending possible matches...")
      return possibleMatches
    } else if (partialMatches.length) {
      console.log("🚩 sending partial matches...")
      return partialMatches
    } else {
      if (remoteMatch.length) {
        console.log("🚩 sending matches based on 1st remote match...")
        return CARDS.filter(card => card.name.includes(remoteMatch[0].name))
      }

      console.log("🚩 sending remote match...")
      return remoteMatch
    }
  } else {
    if (keywordMatches.length) {
      console.log("🚩 sending keyword matches...")
      return keywordMatches
    }
    
    const yugipediaCard = await createCard(USER_KEYWORD)
    if (yugipediaCard.length) {
      console.log(`👑 Yugipedia entry found: "${yugipediaCard[0].name}"`)
      console.log(yugipediaCard[0])
      CARDS.push(yugipediaCard[0])
      return yugipediaCard
    }

    if (possibleMatches.length) {
      console.log("🚩 sending possible matches...")
      return possibleMatches
    }
    
    if (partialMatches.length) {
      console.log("🚩 sending partial matches...")
      return partialMatches
    }

    console.log("🚩 sending remote match...")
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

    if ($('.card-table').length === 0) {
      html = await fetch(`${process.env.SCRAPE_URL}/${card}`)
      html = await html.text()
      $ = cheerio.load(html)

      if ($('.card-table').length === 0) return CARD
    }

    const heading = $('h1').text().trim().replace('Yugipedia', '')
    let name = $('.heading').text().trim()
    if (heading.includes('(Rush Duel)')) name += ' (Rush Duel)'
    const lore = $('.lore').text().trim()
    const tableClass = $('.card-table').attr('class')
    
    let type = $('.innertable tr:contains("Card type") td:nth-child(2)').text().trim()
    if ($('.token-card').length === 1) type = "Token"
    
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

    return CARD
  } catch (err) {
    console.log(`ERROR: couldn't create card [[ ${card} ]] :`, err.message)
    return CARD
  }
}

const updateCards = async () => {
  return fetch(process.env.SEARCH_API)
  .then(data => data.json())
  .then(cards => {
    cards = cards.data
    
    console.log("=====================================")
    console.log("DB CARD COUNT:", CARDS.length)
    console.log("YGOPRODECK CARD COUNT:", cards.length)
    console.log("=====================================")
    
    let newCards = []
    if (cards.length - CARDS.length) {
      console.log("⭕ DATABASE MAY NEED UPDATE!")
  
      const cardstoIgnore = [
        "Blaze Accelerator Deployment (Skill Card)",
        "Call of the Haunted (Skill Card)",
        "Cocoon of Ultra Evolution (Skill Card)",
        "Cyberdark Style (Skill Card)",
        "Destiny Draw (Skill Card)",
        "Double Evolution Pill (Skill Card)",
        "Heavy Metal Raiders (Skill Card)",
        "Land of the Ojamas (Skill Card)",
        "Middle Age Mechs (Skill Card)",
        "Millennium Eye (Skill Card)",
        "Millennium Necklace (Skill Card)",
        "Mind Scan (Skill Card)",
        "Power Bond (Skill Card)",
        "Spell of Mask (Skill Card)",
        "Zombie Master (Skill Card)",
        'Crimson Dragon (card)',
        'Cu Chulainn the Awakened',
        'Damage Vaccine Omega MAX',
        'Esprit Bird Token',
        'Falchion Beta',
        'Fiendish Engine Omega',
        'Gamma the Magnet Warrior',
        'Great Dragon Token',
        'Machine Lord Ur',
        'Man-Eating Black Shark',
        'Marina, Princess of Sunflowers',
        'Nemurelia Louve',
        'Nemurelia Réaliser, the Dreamaterializer Sleeping Princess',
        "Nemurelia's Dreameater - Réveil",
        'Spell Reactor RE',
        'Summon Reactor SK',
        'Synchro Blast Wave',
        'Synchronized Realm',
        'Trap Reactor Y FI',
        'Tri-gate Wizard',
        'Tribute to the Doomed',
        'Twin Long Rods 1',
        'Vanquish Soul - Dr. Madlove',
        'Vanquish Soul - Panthera',
        'Vanquish Soul - Pluton HG'
      ]
  
      cards.forEach(card => {
        if (!cardstoIgnore.includes(card.name) && !CARDS.find(i => i.name === card.name)) {
          console.log("⭐ NEW CARD:", card.name)
          newCards.push(card)
        }
      })
    }

    if (!newCards.length) return console.log("❎ NO NEW CARDS FOUND.")

    const newCardsArray = newCards.map(card => createCard(card.name))
    return Promise.all(newCardsArray)
    .then(cards => {
      cards = cards.reduce((acc, curr) => {
        if (curr.length) acc.push(curr[0])
        else acc.push(undefined)
        return acc
      }, [])

      cards.forEach((card, index) => {
        if (!card) {
          return console.log("ERROR: Yugipedia page not found for:", newCards[index].name)
        } else {
          console.log("☑️ Found Yugipedia entry for:", newCards[index].name)
          card.lore = newCards[index].desc
          if (card.name === "") card.title = newCards[index].name
          CARDS.push(card)
          newCards[index] = card
        }
      })
    })
    .then(_ => {
      CARDS = CARDS.sort((a, b) => a.name.localeCompare(b.name))
      console.log(`✅ NEW CARD(S) (${newCards.length}) ADDED!`)
      return newCards
    })
  })
  .catch(err => {
    console.log("ERROR: DATABASE UPDATE FAILED!", err.message)
    return { error: "can't update database" }
  })
}





module.exports = {
  normalizeString,
  getRandomCard,
  findClosestCard,
  updateCards
}