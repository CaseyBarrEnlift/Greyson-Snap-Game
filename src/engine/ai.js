import { CARDS_BY_ID } from '../data/cards.js'
import { calculateLocationScore, calculateAllScores, getPlayCost } from './gameEngine.js'

// ─── Candidate play generation ────────────────────────────────────────────────

const MAX_CARDS_PER_LOCATION = 4

function getCandidateSinglePlays(hand, gameState) {
  const plays = []
  const energy = gameState.energy.ai
  for (const card of hand) {
    for (let loc = 0; loc < 3; loc++) {
      const locId = gameState.locations[loc].id
      const cost = getPlayCost(card, locId)
      if (cost <= energy && gameState.locations[loc].cards.ai.length < MAX_CARDS_PER_LOCATION) {
        plays.push([{ card, locationIndex: loc }])
      }
    }
  }
  return plays
}

function getCandidateDoublePlays(hand, gameState) {
  const plays = []
  const energy = gameState.energy.ai
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const c1 = hand[i], c2 = hand[j]
      for (let l1 = 0; l1 < 3; l1++) {
        const cost1 = getPlayCost(c1, gameState.locations[l1].id)
        if (gameState.locations[l1].cards.ai.length >= MAX_CARDS_PER_LOCATION) continue
        for (let l2 = 0; l2 < 3; l2++) {
          const cost2 = getPlayCost(c2, gameState.locations[l2].id)
          const totalCost = cost1 + cost2
          if (totalCost <= energy) {
            // Check slot availability (can be same location)
            const sameLocAiCount = l1 === l2
              ? gameState.locations[l1].cards.ai.length + 1
              : gameState.locations[l2].cards.ai.length
            if (l1 === l2 && sameLocAiCount >= MAX_CARDS_PER_LOCATION) continue
            if (l1 !== l2 && gameState.locations[l2].cards.ai.length >= MAX_CARDS_PER_LOCATION) continue
            plays.push([
              { card: c1, locationIndex: l1 },
              { card: c2, locationIndex: l2 },
            ])
          }
        }
      }
    }
  }
  return plays
}

export function generateCandidatePlays(hand, gameState) {
  return [
    [],                                         // pass (play nothing)
    ...getCandidateSinglePlays(hand, gameState),
    ...getCandidateDoublePlays(hand, gameState),
  ]
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function simulatePlay(candidatePlays, gameState) {
  // Shallow structural copy of locations cards
  const locations = gameState.locations.map((loc, i) => ({
    ...loc,
    cards: { ...loc.cards, ai: [...loc.cards.ai] },
  }))

  let aiHand = [...gameState.hands.ai]

  for (const { card, locationIndex } of candidatePlays) {
    locations[locationIndex] = {
      ...locations[locationIndex],
      cards: {
        ...locations[locationIndex].cards,
        ai: [...locations[locationIndex].cards.ai, { ...card, locationIndex, revealed: true }],
      },
    }
    aiHand = aiHand.filter(c => c.instanceId !== card.instanceId)
  }

  return {
    ...gameState,
    locations,
    hands: { ...gameState.hands, ai: aiHand },
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scorePlay(candidatePlays, gameState) {
  const simState = simulatePlay(candidatePlays, gameState)

  let score = 0
  for (let loc = 0; loc < 3; loc++) {
    const aiP = calculateLocationScore(loc, 'ai', simState)
    const playerP = calculateLocationScore(loc, 'player', simState)
    const delta = aiP - playerP

    if (delta > 0) {
      score += 10 + delta    // winning a location is heavily rewarded
    } else {
      score += delta          // penalise losing positions
    }
  }

  // Small random noise for medium difficulty (avoids perfect play)
  score += (Math.random() - 0.5) * 2

  return score
}

// ─── Main AI decision ─────────────────────────────────────────────────────────

export function computeAIPlay(gameState) {
  const hand = gameState.hands.ai
  if (hand.length === 0) return []

  const candidates = generateCandidatePlays(hand, gameState)
  let best = []
  let bestScore = -Infinity

  for (const candidate of candidates) {
    const s = scorePlay(candidate, gameState)
    if (s > bestScore) {
      bestScore = s
      best = candidate
    }
  }

  return best
}

// ─── Roar decisions ───────────────────────────────────────────────────────────

export function shouldAIRoar(gameState) {
  if (gameState.roar.aiUsed) return false
  if (gameState.turn < 4) return false
  if (gameState.roar.stakes >= 4) return false

  const scores = calculateAllScores(gameState)
  let aiWins = 0
  for (let i = 0; i < 3; i++) {
    if (scores.ai[i] > scores.player[i]) aiWins++
  }
  // Roar if winning 2+ locations with 60% probability
  return aiWins >= 2 && Math.random() < 0.6
}

export function shouldAIAcceptRoar(gameState) {
  const scores = calculateAllScores(gameState)
  let aiWins = 0
  let totalAi = 0, totalPlayer = 0
  for (let i = 0; i < 3; i++) {
    if (scores.ai[i] > scores.player[i]) aiWins++
    totalAi += scores.ai[i]
    totalPlayer += scores.player[i]
  }
  // Accept if winning 2+ locations OR clearly ahead on total power
  return aiWins >= 2 || (totalAi - totalPlayer) > 5
}
