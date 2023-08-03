require('dotenv').config()
const fetch = require('node-fetch')



const tmiOptions = {
  options: { debug: process.env.DEBUG == "true" ? true : false },
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
    "Sorry, it seems like Yugi banished the card you seek to the Shadow Realm!",
    "Kaiba's Blue-Eyes must have taken the card. It's nowhere to be found!",
    "Error 404: Joey's luck ran out, and the card is missing!",
    "Seto Kaiba has confiscated the card for his private collection. No luck!",
    "A wild Exodia appeared and ran off with the card. Try again!",
    "Yugi's Dark Magician hid the card in the Puzzle. Can't find it!",
    "Tea Gardner brewed a potion that made the card disappear. Sorry!",
    "The card was sacrificed to the Winged Dragon of Ra. Tough luck!",
    "Weevil Underwood's insects stole the card. Bugger off!",
    "Mai Valentine's Harpies flew away with the card. Can't catch them!",
    "Tristan accidentally deleted the card from existence. Oops!",
    "Bakura's Millennium Ring absorbed the card's data. Gone!",
    "Pegasus read your mind and moved the card to another dimension!",
    "Joey's Red-Eyes sneezed, and the card got lost in the dust!",
    "The card got caught in a time warp courtesy of Yugi's Time Wizard.",
    "Sorry, but the card is trapped in the Shadow Game. Try later!",
    "Mako Tsunami's ocean waves swept the card away. It's gone!",
    "Rex Raptor's dinosaurs mistook the card for food. It's history now!",
    "Yugi's Duel Disk ran out of batteries, and the card vanished!",
    "The card must have been sacrificed to the Great Moth. No luck!",
    "Sorry, but the card got stuck in the Millennium Puzzle. Try again!",
    "We couldn't find the card; maybe Pegasus used his mind control!",
    "Joey tried to shuffle the cards, and yours went MIA. Whoops!",
    "The card fell into the Shadow Realm's black hole. Unlucky!",
    "Sorry, but Mokuba locked the card away in a safe. Can't access it!",
    "The card transformed into a Kuriboh and escaped. Cute, but gone!",
    "The card got trapped in a Toon World portal. No luck catching it!",
    "Bandit Keith's cheating device made the card disappear. Darn it!",
    "Sorry, but the card turned invisible like Marik's Lava Golem!",
    "Your card got banished to the Shadow Realm by Yami Bakura.",
    "We couldn't find the card; perhaps Yugi's Millennium Puzzle ate it!",
    "The card got stuck in the sands of Kul Elna. No retrieving it!",
    "Yugi's Dark Magician Girl used magic to make the card vanish!",
    "Sorry, but the card is in the KaibaCorp virtual world. Can't fetch it!",
    "Joey's luck malfunctioned, and the card disappeared. Tough break!",
    "Mai Valentine's aroma made the card go poof! No trace left!",
    "The card went on a date with Tristan and hasn't returned. Weird!",
    "Yugi's Slifer the Sky Dragon devoured the card. Can't be found!",
    "The card was sent to the Shadow Realm by the Millennium Eye. Oops!",
    "Sorry, but the card was sacrificed to the Black Luster Soldier. Gone!",
    "Your card got lost in the labyrinth of the Duelist Kingdom. No luck!",
    "Bakura's spirit possessed the card, and it vanished into the shadows!",
    "Pegasus painted the card into a Toon version and took it away!",
    "Sorry, but the card got turned into a pumpkin by Yugi's Magician's Valkyria.",
    "The card disappeared like Yugi's Exodia pieces. Can't find it anywhere!",
    "We couldn't find the card; maybe Yugi's Kuriboh multiplied and hid it!",
    "The card got trapped in the realm of the Orichalcos. No recovering it!",
    "Joey's Flame Swordsman accidentally burned the card. Oops!",
    "Mai Valentine's Harpie Lady Sisters flew off with the card. No trace left!",
    "Your card fell into a dimensional rip created by Yugi's Millennium Puzzle. Try again later!"
]

  const randomIndex = Math.floor(Math.random() * errorMessages.length)
  return `${errorMessages[randomIndex]} 💀`
}





module.exports = {
  tmiOptions,
  getSymbol,
  getCardInfo,
  getCardArray,
  shortenUrlAndReply,
  returnErrMsg,
}