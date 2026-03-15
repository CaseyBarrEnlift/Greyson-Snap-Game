import { CARDS_BY_ID, CARDS } from '../data/cards.js'
import { LOCATIONS } from '../data/locations.js'

// ─── Utility ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() {
  return `card-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Card instantiation ───────────────────────────────────────────────────────

export function createCardInstance(cardId) {
  const def = CARDS_BY_ID[cardId]
  if (!def) throw new Error(`Unknown card: ${cardId}`)
  return {
    instanceId: uid(),
    cardId,
    cost: def.cost,
    power: def.basePower,
    modifiers: [],     // [{ source, amount }]
    revealed: false,
    locationIndex: null,
    copiedAbility: null,
  }
}

export function createDeck(cardIds) {
  return cardIds.map(createCardInstance)
}

// ─── Game initialisation ──────────────────────────────────────────────────────

export function initGame(playerDeckIds, aiDeckIds) {
  // Pick 3 random locations
  const locPool = shuffle(LOCATIONS)
  const locations = locPool.slice(0, 3).map(loc => ({
    id: loc.id,
    revealed: true,
    cards: { player: [], ai: [] },
    modifiers: [],   // [{ source, amount, owner, turns }]
  }))

  const playerDeck = shuffle(createDeck(playerDeckIds))
  const aiDeck = shuffle(createDeck(aiDeckIds))

  // Draw opening hands (3 cards each)
  const playerHand = playerDeck.splice(0, 3)
  const aiHand = aiDeck.splice(0, 3)

  return {
    turn: 1,
    phase: 'play',
    energy: { player: 1, ai: 1 },
    locations,
    hands: { player: playerHand, ai: aiHand },
    decks: { player: playerDeck, ai: aiDeck },
    played: { player: [], ai: [] },
    roar: { stakes: 1, playerUsed: false, aiUsed: false, pendingResponse: false },
    scores: { player: [0, 0, 0], ai: [0, 0, 0] },
    gameOver: false,
    winner: null,
    retreated: null,   // 'player' | 'ai'
    log: [],
  }
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

export function getPlayCost(card, locationId) {
  const loc = LOCATIONS.find(l => l.id === locationId)
  if (!loc) return card.cost
  if (loc.effectType === 'cost-reduction') {
    return Math.max(0, card.cost - loc.effect.amount)
  }
  return card.cost
}

// ─── Power calculation (7 layers) ────────────────────────────────────────────

export function calculatePower(cardInstance, locationIndex, owner, gameState) {
  const locState = gameState.locations[locationIndex]
  const locDef = LOCATIONS.find(l => l.id === locState.id)
  const cardDef = CARDS_BY_ID[cardInstance.cardId]
  const ability = cardInstance.copiedAbility || cardDef.ability

  // Layer 1: base power
  let power = cardInstance.power

  // Layer 2: direct modifiers (Giraffe buffs, Cobra debuffs)
  for (const m of cardInstance.modifiers) {
    power += m.amount
  }

  // Layer 3: River override (power = turn number)
  if (locDef.effectType === 'power-equals-turn') {
    return Math.max(0, gameState.turn + sumModifiers(cardInstance))
  }

  // Layer 4: location flat bonus
  power += calcLocationBonus(cardDef, cardInstance, locDef, locationIndex, owner, gameState)

  // Layer 5: card's own ongoing ability (skip in Arctic)
  const arcticDisabled = locDef.effectType === 'disable-ongoing'
  if (ability?.type === 'ongoing' && !arcticDisabled) {
    power += resolveOngoing(ability, cardInstance, locationIndex, owner, gameState)
  }

  // Layer 6: external ongoing effects from other cards that affect this card
  power += resolveExternalOngoing(cardInstance, locationIndex, owner, gameState, arcticDisabled)

  // Layer 7: floor at 0
  return Math.max(0, power)
}

function sumModifiers(cardInstance) {
  return cardInstance.modifiers.reduce((s, m) => s + m.amount, 0)
}

function calcLocationBonus(cardDef, cardInstance, locDef, locationIndex, owner, gameState) {
  switch (locDef.effectType) {
    case 'all-power-bonus':
      return locDef.effect.amount

    case 'low-cost-bonus':
      return cardDef.cost <= locDef.effect.maxCost ? locDef.effect.amount : 0

    case 'tribe-power-bonus':
      return cardDef.tribes.includes(locDef.effect.tribe) ? locDef.effect.amount : 0

    case 'per-turn-tribe-bonus':
      // Accumulated as modifiers on cards at start of each turn (handled in applyTurnStartEffects)
      return 0

    case 'highest-power-bonus': {
      // +amount to the highest-power card on each side – we need a special pass
      // We mark this card as highest when we compute location score, so skip here.
      // Instead, we handle it in calculateLocationScore directly.
      return 0
    }

    default: {
      // location modifiers stored in locState.modifiers (e.g. Whale)
      const locState = gameState.locations[locationIndex]
      const myMods = locState.modifiers
        .filter(m => m.owner === owner)
        .reduce((s, m) => s + m.amount, 0)
      return myMods
    }
  }
}

function resolveOngoing(ability, cardInstance, locationIndex, owner, gameState) {
  const locState = gameState.locations[locationIndex]
  const friendly = locState.cards[owner]
  const opponent = locState.cards[owner === 'player' ? 'ai' : 'player']
  const cardDef = CARDS_BY_ID[cardInstance.cardId]

  switch (ability.effect) {
    case 'power-per-friendly-tribe': {
      const others = ability.excludeSelf
        ? friendly.filter(c => c.instanceId !== cardInstance.instanceId)
        : friendly
      return others.filter(c => CARDS_BY_ID[c.cardId].tribes.includes(ability.tribe)).length * ability.amount
    }

    case 'power-per-card-here': {
      const total = friendly.length + opponent.length
      const count = ability.excludeSelf ? total - 1 : total
      return Math.max(0, count) * ability.amount
    }

    case 'power-per-friendly-all': {
      const allFriendly = gameState.locations.flatMap(l => l.cards[owner])
      const count = ability.excludeSelf
        ? allFriendly.filter(c => c.instanceId !== cardInstance.instanceId).length
        : allFriendly.length
      return count * ability.amount
    }

    case 'power-if-leftmost':
      return locationIndex === 0 ? ability.amount : 0

    case 'power-if-alone':
      // Only counts from played-on-board (not in played queue); for on-reveal, handled separately
      return friendly.length === 1 && cardInstance.locationIndex === locationIndex ? ability.amount : 0

    case 'power-per-opponent-here':
      return opponent.length * ability.amount

    case 'power-if-cards-in-hand':
      return gameState.hands[owner].length >= ability.threshold ? ability.amount : 0

    case 'power-location-type': {
      const locDef = LOCATIONS.find(l => l.id === locState.id)
      return locDef.tags.some(t => ability.locationTags.includes(t)) ? ability.amount : 0
    }

    case 'power-per-unique-tribe-here': {
      const allHere = [...friendly, ...opponent]
      const tribes = new Set(allHere.flatMap(c => CARDS_BY_ID[c.cardId].tribes))
      return tribes.size * ability.amount
    }

    // Debuffs to opponents are handled in resolveExternalOngoing, not self
    case 'power-debuff-opponent-here':
      return 0

    default:
      return 0
  }
}

function resolveExternalOngoing(cardInstance, locationIndex, owner, gameState, arcticDisabled) {
  if (arcticDisabled) return 0
  const locState = gameState.locations[locationIndex]
  const opponentOwner = owner === 'player' ? 'ai' : 'player'
  let bonus = 0

  // Check opponent cards for debuff effects that target this card's side
  for (const opCard of locState.cards[opponentOwner]) {
    const opDef = CARDS_BY_ID[opCard.cardId]
    const opAbility = opCard.copiedAbility || opDef.ability
    if (opAbility?.type === 'ongoing' && opAbility.effect === 'power-debuff-opponent-here') {
      bonus += opAbility.amount  // amount is negative (e.g. -2)
    }
  }

  return bonus
}

// ─── Location score ───────────────────────────────────────────────────────────

export function calculateLocationScore(locationIndex, owner, gameState) {
  const locState = gameState.locations[locationIndex]
  const locDef = LOCATIONS.find(l => l.id === locState.id)
  const cards = locState.cards[owner]

  let total = 0
  let maxPower = -Infinity
  let maxCard = null

  for (const card of cards) {
    const p = calculatePower(card, locationIndex, owner, gameState)
    total += p
    if (p > maxPower) {
      maxPower = p
      maxCard = card
    }
  }

  // Mountain: +amount to highest-power card on this side
  if (locDef.effectType === 'highest-power-bonus' && maxCard) {
    total += locDef.effect.amount
  }

  return total
}

export function calculateAllScores(gameState) {
  const scores = { player: [0, 0, 0], ai: [0, 0, 0] }
  for (let i = 0; i < 3; i++) {
    scores.player[i] = calculateLocationScore(i, 'player', gameState)
    scores.ai[i] = calculateLocationScore(i, 'ai', gameState)
  }
  return scores
}

// ─── Win condition ────────────────────────────────────────────────────────────

export function checkWinCondition(gameState) {
  const scores = calculateAllScores(gameState)
  let playerWins = 0, aiWins = 0
  for (let i = 0; i < 3; i++) {
    if (scores.player[i] > scores.ai[i]) playerWins++
    else if (scores.ai[i] > scores.player[i]) aiWins++
  }

  if (playerWins >= 2) return 'player'
  if (aiWins >= 2) return 'ai'

  // Tiebreaker: total power
  const playerTotal = scores.player.reduce((s, v) => s + v, 0)
  const aiTotal = scores.ai.reduce((s, v) => s + v, 0)
  if (playerTotal > aiTotal) return 'player'
  if (aiTotal > playerTotal) return 'ai'
  return 'draw'
}

// ─── On Reveal Effects ────────────────────────────────────────────────────────

export function applyOnReveal(cardInstance, locationIndex, owner, gameState) {
  const cardDef = CARDS_BY_ID[cardInstance.cardId]
  const ability = cardInstance.copiedAbility || cardDef.ability
  if (!ability || ability.type !== 'on-reveal') return gameState

  const locDef = LOCATIONS.find(l => l.id === gameState.locations[locationIndex].id)

  // Desert: double on-reveal triggers (apply effect twice)
  const times = locDef.effectType === 'double-on-reveal' ? 2 : 1
  let state = gameState
  for (let t = 0; t < times; t++) {
    state = applySingleOnReveal(ability, cardInstance, locationIndex, owner, state)
  }
  return state
}

function applySingleOnReveal(ability, cardInstance, locationIndex, owner, gameState) {
  const opponent = owner === 'player' ? 'ai' : 'player'
  const locState = gameState.locations[locationIndex]

  switch (ability.effect) {
    case 'power-if-ally-present': {
      const friendly = locState.cards[owner]
      const hasAlly = friendly.some(c => c.cardId === ability.allyId)
      if (hasAlly) {
        return modifyCardPower(gameState, cardInstance.instanceId, ability.amount, 'on-reveal')
      }
      return gameState
    }

    case 'power-if-alone': {
      const friendly = locState.cards[owner]
      if (friendly.length === 1) {
        return modifyCardPower(gameState, cardInstance.instanceId, ability.amount, 'on-reveal')
      }
      return gameState
    }

    case 'buff-card-in-hand': {
      const hand = gameState.hands[owner]
      if (hand.length === 0) return gameState
      const targetCard = hand[0]  // "next" = first card in hand
      return modifyCardPower(gameState, targetCard.instanceId, ability.amount, 'giraffe')
    }

    case 'draw-card': {
      let state = gameState
      for (let i = 0; i < ability.amount; i++) {
        state = drawCard(state, owner)
      }
      return state
    }

    case 'destroy-random-opponent': {
      const oppCards = locState.cards[opponent]
      if (oppCards.length === 0) return gameState
      const idx = Math.floor(Math.random() * oppCards.length)
      return removeCard(gameState, oppCards[idx].instanceId, locationIndex, opponent)
    }

    case 'move-to-opponent-strongest': {
      // Find location where opponent has most power
      let bestLoc = locationIndex
      let bestPower = -1
      for (let i = 0; i < 3; i++) {
        const p = calculateLocationScore(i, opponent, gameState)
        if (p > bestPower) {
          bestPower = p
          bestLoc = i
        }
      }
      if (bestLoc === locationIndex) return gameState
      return moveCard(gameState, cardInstance.instanceId, locationIndex, bestLoc, owner)
    }

    case 'debuff-opponent-highest': {
      const oppCards = locState.cards[opponent]
      if (oppCards.length === 0) return gameState
      let highestCard = oppCards[0]
      let highestPower = calculatePower(oppCards[0], locationIndex, opponent, gameState)
      for (const c of oppCards) {
        const p = calculatePower(c, locationIndex, opponent, gameState)
        if (p > highestPower) {
          highestPower = p
          highestCard = c
        }
      }
      return modifyCardPower(gameState, highestCard.instanceId, ability.amount, 'cobra')
    }

    case 'destroy-weak-cards': {
      // Destroy all cards (both sides) with base power + modifiers <= threshold
      let state = gameState
      const allCards = [
        ...locState.cards[owner].map(c => ({ c, o: owner })),
        ...locState.cards[opponent].map(c => ({ c, o: opponent })),
      ]
      for (const { c, o } of allCards) {
        if (c.instanceId === cardInstance.instanceId) continue
        const effectivePower = c.power + c.modifiers.reduce((s, m) => s + m.amount, 0)
        if (effectivePower <= ability.threshold) {
          state = removeCard(state, c.instanceId, locationIndex, o)
        }
      }
      return state
    }

    case 'buff-opponent-location': {
      // Add a flat power modifier to opponent's side of a random location
      const randLocIdx = Math.floor(Math.random() * 3)
      return addLocationModifier(gameState, randLocIdx, opponent, ability.amount, 'whale')
    }

    case 'copy-next-ability': {
      const hand = gameState.hands[owner]
      if (hand.length === 0) return gameState
      const nextCard = hand[0]
      const nextDef = CARDS_BY_ID[nextCard.cardId]
      if (!nextDef.ability) return gameState
      return modifyCardCopiedAbility(gameState, cardInstance.instanceId, nextDef.ability)
    }

    default:
      return gameState
  }
}

// ─── Turn-start / turn-end effects ───────────────────────────────────────────

export function applyTurnStartEffects(gameState) {
  let state = gameState
  for (let i = 0; i < 3; i++) {
    const locState = state.locations[i]
    const locDef = LOCATIONS.find(l => l.id === locState.id)
    if (locDef.effectType === 'per-turn-tribe-bonus') {
      const { tribe, amount } = locDef.effect
      for (const owner of ['player', 'ai']) {
        for (const card of locState.cards[owner]) {
          if (CARDS_BY_ID[card.cardId].tribes.includes(tribe)) {
            state = modifyCardPower(state, card.instanceId, amount, `${locDef.id}-turn`)
          }
        }
      }
    }
  }
  return state
}

export function applyTurnEndEffects(gameState) {
  let state = gameState
  for (let i = 0; i < 3; i++) {
    const locState = state.locations[i]
    const locDef = LOCATIONS.find(l => l.id === locState.id)
    if (locDef.effectType === 'destroy-weakest-per-turn') {
      // Destroy the single card with lowest effective power across both sides
      const allCards = [
        ...locState.cards.player.map(c => ({ c, o: 'player' })),
        ...locState.cards.ai.map(c => ({ c, o: 'ai' })),
      ]
      if (allCards.length === 0) continue
      allCards.sort((a, b) => {
        const pa = calculatePower(a.c, i, a.o, state)
        const pb = calculatePower(b.c, i, b.o, state)
        return pa - pb
      })
      const { c, o } = allCards[0]
      state = removeCard(state, c.instanceId, i, o)
    }
  }
  return state
}

// ─── Draw card ────────────────────────────────────────────────────────────────

export function drawCard(gameState, owner) {
  const deck = gameState.decks[owner]
  if (deck.length === 0) return gameState
  const [drawn, ...rest] = deck
  return {
    ...gameState,
    decks: { ...gameState.decks, [owner]: rest },
    hands: { ...gameState.hands, [owner]: [...gameState.hands[owner], drawn] },
  }
}

// ─── Immutable state helpers ──────────────────────────────────────────────────

function modifyCardPower(gameState, instanceId, amount, source) {
  return updateCard(gameState, instanceId, card => ({
    ...card,
    modifiers: [...card.modifiers, { source, amount }],
  }))
}

function modifyCardCopiedAbility(gameState, instanceId, ability) {
  return updateCard(gameState, instanceId, card => ({
    ...card,
    copiedAbility: ability,
  }))
}

function updateCard(gameState, instanceId, updater) {
  // Search hands, decks, and all location cards
  function updateList(list) {
    return list.map(c => c.instanceId === instanceId ? updater(c) : c)
  }

  return {
    ...gameState,
    hands: {
      player: updateList(gameState.hands.player),
      ai: updateList(gameState.hands.ai),
    },
    decks: {
      player: updateList(gameState.decks.player),
      ai: updateList(gameState.decks.ai),
    },
    locations: gameState.locations.map(loc => ({
      ...loc,
      cards: {
        player: updateList(loc.cards.player),
        ai: updateList(loc.cards.ai),
      },
    })),
  }
}

function removeCard(gameState, instanceId, locationIndex, owner) {
  return {
    ...gameState,
    locations: gameState.locations.map((loc, i) => {
      if (i !== locationIndex) return loc
      return {
        ...loc,
        cards: {
          ...loc.cards,
          [owner]: loc.cards[owner].filter(c => c.instanceId !== instanceId),
        },
      }
    }),
  }
}

function moveCard(gameState, instanceId, fromLocIndex, toLocIndex, owner) {
  let card = null
  let state = gameState

  // Remove from source
  state = {
    ...state,
    locations: state.locations.map((loc, i) => {
      if (i !== fromLocIndex) return loc
      const found = loc.cards[owner].find(c => c.instanceId === instanceId)
      if (found) card = { ...found, locationIndex: toLocIndex }
      return {
        ...loc,
        cards: {
          ...loc.cards,
          [owner]: loc.cards[owner].filter(c => c.instanceId !== instanceId),
        },
      }
    }),
  }

  if (!card) return gameState

  // Add to destination
  state = {
    ...state,
    locations: state.locations.map((loc, i) => {
      if (i !== toLocIndex) return loc
      return {
        ...loc,
        cards: {
          ...loc.cards,
          [owner]: [...loc.cards[owner], card],
        },
      }
    }),
  }
  return state
}

function addLocationModifier(gameState, locationIndex, owner, amount, source) {
  return {
    ...gameState,
    locations: gameState.locations.map((loc, i) => {
      if (i !== locationIndex) return loc
      return {
        ...loc,
        modifiers: [...loc.modifiers, { owner, amount, source }],
      }
    }),
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function gameReducer(state, action) {
  switch (action.type) {
    case 'INIT_GAME':
      return initGame(action.playerDeck, action.aiDeck)

    case 'PLAY_CARD': {
      // Move card from hand to played queue
      const { instanceId, locationIndex } = action
      const card = state.hands.player.find(c => c.instanceId === instanceId)
      if (!card) return state
      const locId = state.locations[locationIndex].id
      const cost = getPlayCost(card, locId)
      if (cost > state.energy.player) return state
      return {
        ...state,
        energy: { ...state.energy, player: state.energy.player - cost },
        hands: { ...state.hands, player: state.hands.player.filter(c => c.instanceId !== instanceId) },
        played: {
          ...state.played,
          player: [...state.played.player, { ...card, locationIndex }],
        },
      }
    }

    case 'UNPLAY_CARD': {
      const { instanceId } = action
      const card = state.played.player.find(c => c.instanceId === instanceId)
      if (!card) return state
      const locId = state.locations[card.locationIndex].id
      const cost = getPlayCost(card, locId)
      return {
        ...state,
        energy: { ...state.energy, player: state.energy.player + cost },
        hands: { ...state.hands, player: [...state.hands.player, card] },
        played: {
          ...state.played,
          player: state.played.player.filter(c => c.instanceId !== instanceId),
        },
      }
    }

    case 'COMMIT_TURN': {
      // Called after AI play is computed; moves all played cards onto the board
      const { aiPlays } = action
      let state2 = state

      // Commit player cards
      for (const card of state.played.player) {
        const locIdx = card.locationIndex
        state2 = {
          ...state2,
          locations: state2.locations.map((loc, i) => {
            if (i !== locIdx) return loc
            return {
              ...loc,
              cards: { ...loc.cards, player: [...loc.cards.player, { ...card, revealed: false }] },
            }
          }),
        }
      }

      // Commit AI cards (from ai plays)
      for (const play of aiPlays) {
        const card = { ...play.card, locationIndex: play.locationIndex, revealed: false }
        state2 = {
          ...state2,
          hands: { ...state2.hands, ai: state2.hands.ai.filter(c => c.instanceId !== play.card.instanceId) },
          locations: state2.locations.map((loc, i) => {
            if (i !== play.locationIndex) return loc
            return {
              ...loc,
              cards: { ...loc.cards, ai: [...loc.cards.ai, card] },
            }
          }),
        }
      }

      // Clear played queues
      state2 = {
        ...state2,
        played: { player: [], ai: [] },
        phase: 'reveal',
      }
      return state2
    }

    case 'REVEAL_CARD': {
      const { instanceId } = action
      return updateCard(state, instanceId, card => ({ ...card, revealed: true }))
    }

    case 'APPLY_ON_REVEAL': {
      const { instanceId, locationIndex, owner } = action
      const locState = state.locations[locationIndex]
      const card = locState.cards[owner].find(c => c.instanceId === instanceId)
      if (!card) return state
      return applyOnReveal(card, locationIndex, owner, state)
    }

    case 'NEXT_TURN': {
      let state2 = applyTurnEndEffects(state)
      if (state.turn >= 6) {
        const winner = action.winner || checkWinCondition(state2)
        return {
          ...state2,
          gameOver: true,
          winner,
          scores: calculateAllScores(state2),
        }
      }
      const nextTurn = state.turn + 1
      state2 = applyTurnStartEffects(state2)
      state2 = drawCard(state2, 'player')
      state2 = drawCard(state2, 'ai')
      return {
        ...state2,
        turn: nextTurn,
        phase: 'play',
        energy: { player: nextTurn, ai: nextTurn },
        scores: calculateAllScores(state2),
      }
    }

    case 'ROAR': {
      // Player uses Roar
      if (state.roar.playerUsed) return state
      return {
        ...state,
        roar: {
          ...state.roar,
          stakes: state.roar.stakes * 2,
          playerUsed: true,
          pendingResponse: true,
          respondingOwner: 'ai',
        },
      }
    }

    case 'AI_ROAR': {
      // AI uses Roar
      if (state.roar.aiUsed) return state
      return {
        ...state,
        roar: {
          ...state.roar,
          stakes: state.roar.stakes * 2,
          aiUsed: true,
          pendingResponse: true,
          respondingOwner: 'player',
        },
      }
    }

    case 'ACCEPT_ROAR':
      return { ...state, roar: { ...state.roar, pendingResponse: false } }

    case 'RETREAT': {
      // The retreating side loses stakes/2
      const retreatingOwner = state.roar.respondingOwner === 'player' ? 'player' : 'ai'
      const winner = retreatingOwner === 'player' ? 'ai' : 'player'
      return {
        ...state,
        gameOver: true,
        winner,
        retreated: retreatingOwner,
        roar: { ...state.roar, pendingResponse: false },
      }
    }

    case 'UPDATE_SCORES':
      return { ...state, scores: calculateAllScores(state) }

    default:
      return state
  }
}
