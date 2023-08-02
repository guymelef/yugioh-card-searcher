require('dotenv').config()
const fetch = require('node-fetch')



const tmiOptions = {
  options: { debug: process.env.DEBUG ? true : false },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  }
}

const cardSymbols = {
  Normal: '🟡',
  Effect: '🟠',
  Ritual: '🔵',
  Fusion: '🟣',
  Synchro: '⚪',
  Tuner: '🟤',
  Spell: '🟢',
  Trap: '🔴',
  XYZ: '⚫',
  Token: '🃏',
  Link: '🔗',
  Pendulum: '🌗',
  Skill: '✨'
}

const getSymbol = (cardType) => cardSymbols[cardType] ? cardSymbols[cardType] : '🟠'

const getCardInfo = (card) => {
  let cardInfo

  if (["Spell Card", "Trap Card"].includes(card.type)) {
    cardInfo = `🔎 ${card.name} [${card.race} ${card.type.replace(' Card', '')}] : ${card.desc}`
  } else {
    cardInfo = `
      🔎 ${card.name} ${card.attribute ? `(${card.attribute})`: ''} ${card.level ? `[${card.level}⭐]`: ''} ${card.scale ? `[◀${card.scale}▶]` : ''} [${card.race}${card.type === "Skill Card" ? ` ${card.type}` : `/${card.type.replace(/ Monster/g, '').replace(/ /g, '/')}`}] ${card.atk ? `[ATK/${card.atk}${card.def || card.def === 0 ? ` DEF/${card.def}`: ''}${card.linkval ? ` LINK—${card.linkval}] [${formatArrows(card.linkmarkers)}]` : ']'}` : ''} : ${card.desc.replace(/-{40}/g, '')}
    `
  }

  return cardInfo
}

const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    const symbol = getSymbol(card.type.split(' ')[0])
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} ${cards.length === 1 ? 'Card' : 'Cards'}] : ${cardsArray.join(', ')}`
}

const shortenUrlAndReply = (client, channel, userName, card) => {
  const raw = JSON.stringify({
    group_guid: `${process.env.BITLY_GUID}`,
    domain: "bit.ly",
    long_url: `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`
  })

  const requestOptions = {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.BITLY_TOKEN}`
    },
    redirect: "follow"
  }

  return fetch(process.env.BITLY_API, requestOptions)
    .then(response => response.json())
    .then(result => {
      return client.say(channel, `📸 "${card.name}" - [ ${result.link} ]`)
    })
    .catch(err => client.say(channel, `${userName}, there was an error. Try again.`))
}

const formatArrows = (array) => {
  const markers = {
    "Top-Left": 0,
    "Top": 1,
    "Top-Center": 1,
    "Top-Right": 2,
    "Middle-Left": 3,
    "Left": 3,
    "Bottom-Left": 4,
    "Bottom-Center": 5,
    "Bottom": 5,
    "Bottom-Right": 6,
    "Middle-Right": 7,
    "Right": 7
  }

  const arrows = ['↖️', '⬆️', '↗️', '⬅️', '↙️', '⬇️', '↘️', '➡️']
  let arrowArray = array
  arrowArray = arrowArray.map(arrow => markers[arrow]).sort()
  arrowArray = arrowArray.map(arrow => arrows[arrow]).join('')
  return arrowArray
}

const returnErrMsg = () => {
  const errorMessages = [
    "Error 404: Card not found... but we did find a Blue-Eyes White Rabbit hopping around!",
    "Pikachu used Thunderbolt, and now our search system is electrified and confused!",
    "Sorry, but Mewtwo teleported the card you're looking for to another dimension.",
    "Kaiba has sent the card you seek to the Shadow Realm for safekeeping!",
    "Error 404: Card not found... maybe it's in the Millennium Puzzle?",
    "Our search algorithm got trapped in a time warp with Doctor Who and can't find your card.",
    "Looks like the card you want is hiding with Waldo. Keep searching!",
    "It seems the card you're after is trapped in Jumanji. Good luck getting it out!",
    "Yoda says, 'Card not found, it is. Patience, young duelist, you must have.'",
    "Sorry, but the card you're searching for was devoured by a hungry Hungry Hippo.",
    "Bowser kidnapped the card you're seeking to challenge Mario!",
    "We searched everywhere but couldn't find the card. Maybe try using the Force?",
    "Our search system got caught in a real-life Among Us game and can't find the imposter card!",
    "Waldo has disguised the card you're looking for as himself. Can you spot it?",
    "Error 404: Card not found... but there's a talking donkey offering to help you find it!",
    "Looks like the card is on vacation in the Pokémon Resort. It's having a great time!",
    "Gandalf the Grey can't find the card you're seeking, but he'll keep searching the Mines of Moria.",
    "Sorry, but the card is at a tea party with the Mad Hatter. Tea time is a priority!",
    "Our search system got caught in a duel between Mario and Bowser. It's-a me, not your card!",
    "Marty McFly went back in time and accidentally misplaced the card you're looking for.",
    "Error 404: Card not found... It must have fallen into a black hole!",
    "Scooby-Doo and the gang can't find the card, but they found Slimer instead. He's pretty slimy!",
    "The Minions accidentally hid the card in their banana stash. They're very protective!",
    "The Road Runner is too fast for our search algorithm. Beep, beep!",
    "Error 404: Card not found... maybe it's in the Upside Down with Eleven and the Demogorgon?",
    "The Ghostbusters tried searching, but they found Slimer instead. He's pretty slimy!",
    "Sorry, but the card you're looking for is playing hide-and-seek with Elmo!",
    "The card is chilling with Olaf in the Enchanted Forest. Warm hugs for everyone!",
    "Error 404: Card not found... but there's a Minotaur looking for a maze partner!",
    "Sonic the Hedgehog can't find the card, but he ran circles around our search system!",
    "The Teenage Mutant Ninja Turtles can't find the card, but they found pizza instead!",
    "The card is disguised as a Minion, speaking Minionese! Banana!",
    "Error 404: Card not found... but there's a magical wardrobe that might lead to Narnia!",
    "Our search system encountered a wild Pikachu, and it got distracted.",
    "Sorry, but the card is stuck in a dance battle with Baby Groot. It's an adorable competition!",
    "Error 404: Card not found... it must be on a quest with Frodo to Mount Doom!",
    "Homer Simpson found the card, but he's too busy eating donuts to give it back!",
    "The card joined a band with the Trolls! They're rocking out in Troll Village!",
    "Error 404: Card not found... maybe it's in Atlantis with SpongeBob and Patrick?",
    "Sorry, but the card is in a rap battle with Deadpool. It's a battle of words!",
    "The card got caught in a Spider-Man web-slinging adventure. Spidey is busy being amazing!",
    "Error 404: Card not found... it's trapped in the Toy Story toy box with Woody and Buzz!",
    "The card is stuck in a dance-off with the Kung Fu Panda. It's a furry showdown!",
    "Sorry, but the card is being guarded by the dragon Smaug. Bring some dwarves and a hobbit!",
    "The card is playing hide-and-seek with Winnie the Pooh in the Hundred Acre Wood!",
    "Error 404: Card not found... but there's a wild Wookiee ready to help you search!",
    "The Minions accidentally launched the card into outer space. Houston, we have a problem!",
    "The card went on a cruise with SpongeBob and Patrick. It's soaking up the sun in Bikini Bottom!",
    "Error 404: Card not found... it's trapped in the land of Ooo with Finn and Jake!",
    "Sorry, but the card is at a party with the Trolls. They know how to celebrate!",
  ]

  const randomIndex = Math.floor(Math.random() * errorMessages.length)
  return `💀 ${errorMessages[randomIndex]}`
}





module.exports = {
  tmiOptions,
  getSymbol,
  getCardInfo,
  getCardArray,
  shortenUrlAndReply,
  returnErrMsg,
}