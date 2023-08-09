require('dotenv').config()



const tmiOptions = {
  options: { debug: process.env.DEBUG === "true" },
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  }
}

const getSymbol = (cardType) => {
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

  return cardSymbols[cardType] || '🟡'
}

const getCardInfo = (card) => {
  if (["Spell", "Trap"].includes(card.type)) {
    return `🔎 ${card.name} [${card.property} ${card.type}] : ${card.lore}`
  } else if (card.type === "Skill") {
    return `🔎 ${card.name} [${card.types}] : ${card.lore}`
  } else {
    if (card.types.includes("Pendulum")) {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.level}⭐] [◀${card.scale}▶] [${card.types}] [ATK/${card.atk} DEF/${card.def}] : ${card.lore.replace(/-{2,}]/, '')}
      `
    } else if (card.types.includes("Link")) {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.types}] [ATK/${card.atk} LINK—${card.linkRating}] [${formatArrows(card.linkArrows)}] : ${card.lore}
      `
    } else {
      return `
        🔎 ${card.name} (${card.attribute}) [${card.level}⭐] [${card.types}] [ATK/${card.atk} DEF/${card.def}] : ${card.lore}
      `
    }
  }
}

const getCardArray = (cards) => {
  const cardsArray = cards.map(card => {                
    let symbol = ""
    if (card.type === "Monster") {
      symbol = card.types.split('/')
      if (symbol.includes("Pendulum")) symbol = getSymbol("Pendulum")
      else if (symbol.length > 1) symbol = getSymbol(symbol[1])
      else symbol = getSymbol(symbol[0])
    } else {
      symbol = getSymbol(card.type)
    }
    return `${symbol}${card.name}`
  })
  return `📜 [${cards.length} ${cards.length > 1 ? 'Cards' : 'Card'}] : ${cardsArray.join(', ')}`
}

const shortenUrlAndReply = (client, channel, userName, card) => {
  const raw = JSON.stringify({
    group_guid: `${process.env.BITLY_GUID}`,
    domain: "bit.ly",
    long_url: card.image
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
    "Top-Left": '↖️',
    "Top-Center": '⬆️',
    "Top-Right": '↗️',
    "Middle-Left": '⬅️',
    "Bottom-Left": '↙️',
    "Bottom-Center": '⬇️',
    "Bottom-Right": '↘️',
    "Middle-Right": '➡️',
  }
  return array.map(arrow => markers[arrow.trim()]).join('')
}

const returnErrMsg = () => {
  const errorMessages = [
    "Looks like the Winged Dragon of Ra ate your card. It's feeling divine!",
    "Mai's Harpies mistook your card for prey. Expect it back eventually.",
    "Your card was kidnapped by Dark Magician Girl for a magical tea party.",
    "Exodia the Forbidden One accidentally assembled your card and vanished.",
    "The Blue-Eyes White Dragon is feeling shy today and won't show your card.",
    "Joey's luck must've rubbed off – your card is on a lucky streak.",
    "Bakura's Millennium Ring suggests your card is in the shadowy depths.",
    "Your card challenged Yugi to a duel and got lost in the Shadow Realm.",
    "Sorry, Kaiba's ego overloaded the database. Your card got caught up.",
    "Yami Marik's mind games made your card question its existence.",
    "Yugi's grandpa couldn't find your card in his treasure chest of nostalgia.",
    "Tea thinks your card is lost in the realm of friendship. Keep searching!",
    "Your card traveled back in time with Jaden. They're having a blast!",
    "Mokuba hid your card in the KaibaCorp office. Can you find it?",
    "The Pharaoh gave your card to the Duel Monsters Spirit. Good luck retrieving it!",
    "Serenity accidentally folded your card into a paper airplane. It's soaring!",
    "Dartz's Orichalcos magic absorbed your card. Hope it's enjoying the power boost!",
    "Your card got caught in Joey's time-traveling scam. Temporal troubles!",
    "Astral mistook your card for a Number. It's now part of the Astral World.",
    "Rex Raptor's dinosaurs are using your card as a chew toy. Dino-fun!",
    "Mako Tsunami's waves swept your card to the depths of the database sea.",
    "Tristan used your card to fix a vending machine. It's stuck inside now.",
    "The Dark Magician's magic turned your card into a real bunny. Hoppy times!",
    "Pegasus turned your card into a work of art. It's now a masterpiece!",
    "Your card's reflection got trapped in a Mirror Force. It's reflecting on life.",
    "Sorry, Joey accidentally bet your card in a duel and lost. Gambling woes!",
    "Marik's Millennium Rod mind-controlled your card. It's plotting revenge!",
    "Seto's Blue-Eyes White Dragon protected your card. It's under draconic custody.",
    "Your card fell into the Deck Master ability pool. It's making new friends!",
    "The Egyptian Gods invited your card to their divine summit. Heavenly discussions!",
    "Yugi's Dark Magician stole your card's spotlight. It's playing second fiddle.",
    "Your card wandered into the Duelist Kingdom. It's enjoying the festivities!",
    "Weevil threw your card overboard the blimp. It's floating in the air!",
    "Sorry, your card got stuck in Yugi's spiky hair. A stylish hiding place!",
    "The Millennium Puzzle absorbed your card's power. Hope it enjoys the boost!",
    "Joey's dueling skills are no match for your card's evasive maneuvers!",
    "The Neo-Spacians kidnapped your card for a cosmic adventure. Starry skies await!",
    "Kaiba's Blue-Eyes jet took your card on a world tour. International travels!",
    "Yugi's Duel Disk glitched and teleported your card to the Shadow Realm. Oof!",
    "Your card joined Bandit Keith's cheat sheet collection. It's in good company!",
    "The Exodia pieces mistook your card for their long-lost brother. Reunion time!",
    "Sorry, your card challenged the Red-Eyes Black Dragon to a staring contest and lost.",
    "The Millennium Necklace predicted your card's disappearance. Fate is fickle!",
    "Tristan used your card as a bookmark. Hope he doesn't lose it in a book!",
    "The Paradox Brothers' labyrinthine tricks trapped your card in a twisty puzzle.",
    "The Millennium Scales balanced your card into another dimension. Scales of fate!",
    "Duke Devlin turned your card into a dice. Roll for its location!",
    "Sorry, your card became a prop in Yami Yugi's dramatic duel. Theatrical fate!",
    "The Kuribohs mistook your card for a Kuriboh plushie. Cute confusion!",
    "Seto's Blue-Eyes Jet couldn't handle the turbulence and dropped your card. Bumpy ride!",
    "Yugi's grandpa fell asleep on your card. He's having a cardnap!",
    "The Millennium Rod chose your card as its new master. Marik approves!",
    "Your card got mixed up in Crowler's school supplies. Detention time!",
    "The Crystal Beasts carried your card away to their colorful hideout. Gemtastic!",
    "Zane's Cyber Dragons accidentally downloaded your card's data. Digital adventures!",
    "Sorry, your card fell into Joey's soup. It's having a soggy time!",
    "The Dark Magician Girl's magic enchanted your card. It's under a spell!",
    "Your card joined the Ancient Gears and got caught in their mechanical workings.",
    "The Millennium Eye saw your card's destiny, but it's not sharing the info!",
    "Mai's harpies borrowed your card for a shopping spree. Fashionable fun!",
    "The Dark Magician pulled a disappearing act and took your card with him.",
    "Joey mistook your card for a rare sandwich. Lunchtime hijinks!",
    "Your card was caught in Pegasus' shadow game. Can you solve the puzzle?",
    "The Flame Swordsman wanted a sparring partner, so he took your card. Fiery duels!",
    "The Millennium Puzzle absorbed your card's energy. It's in a puzzling situation!",
    "Kaiba's Blue-Eyes Jet took your card on a skydiving adventure. Sky-high fun!",
    "The Slifer the Sky Dragon mistook your card for an offering. Divine mix-up!",
    "The Celtic Guardian mistook your card for an opponent. It's dueling with honor!",
    "Sorry, Yugi's grandpa misplaced your card in the Domino Museum. Ancient artifacts!",
    "The Toon World beckoned your card into its animated realm. Toon-tastic!",
    "The Dark Magician challenged your card to a magic duel. It vanished in a puff of smoke!",
    "Mai's Harpie Lady Sisters invited your card for a girls' night out. Party time!",
    "The Millennium Puzzle absorbed your card's essence. Yugi's gotta solve this one!",
    "Weevil's insects carried your card to their creepy-crawly lair. Insect adventure!",
    "The Duel Disk's holographic glitch turned your card into a holographic glitch. Meta glitch!",
    "Kaiba's Obelisk the Tormentor summoned your card for divine protection. Godly intervention!",
    "The Elemental HEROes took your card to their training ground. Time for some heroics!",
    "Joey's Red-Eyes Black Dragon took your card on a joyride. Fire-breathing fun!",
    "The Millennium Ring claimed your card for its collection. Thief King Bakura approves!",
    "The Dark Magician Girl transformed your card into a magical scroll. Enchanting!",
    "Sorry, your card got stuck in the vending machine. Insert more coins!",
    "The Cyber Angels carried your card away to the celestial realm. Heavenly heights!",
    "The Millennium Necklace saw your card's future and decided it should stay hidden.",
    "The Winged Kuriboh whisked your card away to the spirit world. Spirit-y adventures!",
    "Sorry, Joey's luck took a liking to your card and won't let it go!",
    "The Pharaoh gave your card to the Kuribohs. It's having a fluffy time!",
    "The Blue-Eyes White Dragon flew off with your card. It's soaring with legends!",
    "The Dark Magician trapped your card in a dark magic circle. Mystery and magic!",
    "The Millennium Scales balanced your card into another dimension. Unbalanced reality!",
    "The Cyberdark Dragon absorbed your card's power. Darkness prevails!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the shuffle!",
    "The Destiny Board spelled out your card's fate. Can you read the signs?",
    "The Millennium Puzzle absorbed your card's essence. Yugi's got some solving to do!",
    "Your card challenged the Elemental HEROes to a duel and lost. Heroic defeat!",
    "The Sky Strikers took your card on an aerial adventure. Sky-high dueling!",
    "The Toon World transported your card to its animated dimension. Toon-tastic!",
    "The Millennium Rod took control of your card. Marik is pulling the strings!",
    "Sorry, the Millennium Necklace predicted that your card would go missing. Fate sealed!",
    "The Dark Magician's magic pulled your card into a vortex. Mysterious disappearances!",
    "The Elemental HEROes invited your card to their hero training camp. Training time!",
    "The Dark Magician Girl borrowed your card for a magical makeover. Enchanting!",
    "Sorry, your card got stuck in the virtual reality game. Digital hijinks!",
    "The Wicked Gods imprisoned your card in their realm. Wickedly mysterious!",
    "The Millennium Scales balanced your card into another dimension. Unbalanced fate!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the chaos!",
    "The Crystal Beasts hid your card in their colorful hideout. Gem-filled fun!",
    "The Legendary Fisherman reeled in your card. It's fishing for adventure!",
    "The Millennium Ring claimed your card as its newest treasure. Ancient magic!",
    "The Toon World whisked your card away to its wacky dimension. Toon-tastic!",
    "The Elemental HEROes took your card on a hero adventure. Heroic journey!",
    "Sorry, the Destiny Board spelled out your card's disappearance. Eerie fate!",
    "The Dark Magician's magic transported your card to another realm. Mystical travels!",
    "The Cyberdark Dragon absorbed your card's power. Darkness consumes!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the shuffle of destiny!",
    "The Millennium Necklace foresaw your card's fate. Secrets of the future!",
    "The Winged Kuriboh whisked your card away to the spirit realm. Spirit-y escapades!",
    "Sorry, Joey's luck took a liking to your card and won't let it go!",
    "The Pharaoh gave your card to the Kuribohs. It's having a fluffy time!",
    "The Blue-Eyes White Dragon soared off with your card. It's riding the winds of legend!",
    "The Dark Magician trapped your card in a magic circle. Enchanted mysteries!",
    "The Millennium Scales balanced your card into another dimension. Balance in the unknown!",
    "The Millennium Rod took control of your card. Marik's domination!",
    "Sorry, the Millennium Necklace predicted your card's vanishing act. Destiny foretold!",
    "The Dark Magician's magic pulled your card into a vortex. Mystical disappearance!",
    "The Elemental HEROes invited your card to their hero training camp. Training in action!",
    "The Dark Magician Girl borrowed your card for a magical makeover. Enchanted transformation!",
    "Sorry, your card got stuck in the virtual realm. Virtual reality glitch!",
    "The Wicked Gods claimed your card as their own. Wickedly mysterious ownership!",
    "The Millennium Scales balanced your card into another dimension. Unbalanced enigma!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the shuffle of destiny!",
    "The Crystal Beasts hid your card in their colorful realm. Gem-filled adventure!",
    "The Legendary Fisherman reeled in your card. It's diving into aquatic escapades!",
    "The Millennium Ring declared your card as its newest treasure. Ancient enchanter!",
    "The Toon World whisked your card away to its wacky dimension. Toon-tacular antics!",
    "The Elemental HEROes took your card on a hero adventure. Heroic quests await!",
    "Sorry, the Destiny Board spelled out your card's mysterious disappearance. Eerie clues!",
    "The Dark Magician's magic transported your card to another realm. Mysterious journey!",
    "The Cyberdark Dragon absorbed your card's power. Darkness prevails!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the shuffle of destiny!",
    "The Millennium Necklace foresaw your card's fate. Secrets of the future await!",
    "The Winged Kuriboh whisked your card away to the spirit realm. Spirit-y escapades!",
    "Sorry, Joey's luck took a liking to your card and won't let it go!",
    "The Pharaoh gave your card to the Kuribohs. It's having a fluffy time!",
    "The Blue-Eyes White Dragon soared off with your card. It's riding the winds of legend!",
    "The Dark Magician trapped your card in a magic circle. Enchanted mysteries!",
    "The Millennium Scales balanced your card into another dimension. Balance in the unknown!",
    "The Millennium Rod took control of your card. Marik's domination!",
    "Sorry, the Millennium Necklace predicted your card's vanishing act. Destiny foretold!",
    "The Dark Magician's magic pulled your card into a vortex. Mystical disappearance!",
    "The Elemental HEROes invited your card to their hero training camp. Training in action!",
    "The Dark Magician Girl borrowed your card for a magical makeover. Enchanted transformation!",
    "Sorry, your card got stuck in the virtual realm. Virtual reality glitch!",
    "The Wicked Gods claimed your card as their own. Wickedly mysterious ownership!",
    "The Millennium Scales balanced your card into another dimension. Unbalanced enigma!",
    "The Duel Disk shuffled your card into the Deck. It's lost in the shuffle of destiny!",
    "The Crystal Beasts hid your card in their colorful realm. Gem-filled adventure!",
    "The Legendary Fisherman reeled in your card. It's diving into aquatic escapades!",
    "The Millennium Ring declared your card as its newest treasure. Ancient enchanter!",
    "The Toon World whisked your card away to its wacky dimension. Toon-tacular antics!",
    "The Elemental HEROes took your card on a hero adventure. Heroic quests await!",
    "Sorry, the Destiny Board spelled out your card's mysterious disappearance. Eerie clues!",
    "The Dark Magician's magic transported your card to another realm. Mysterious journey!",
    "The Cyberdark Dragon absorbed your card's power. Darkness prevails!"
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