import { STARTER_CARD_IDS, DEFAULT_DECK, CARDS } from '../data/cards.js'

const KEY = 'animal-snap-progress'

const UNLOCK_THRESHOLDS = [
  { cubes: 5,  cardId: 'crocodile' },
  { cubes: 10, cardId: 'octopus' },
  { cubes: 20, cardId: 'wolf' },
  { cubes: 35, cardId: 'peacock' },
]

export function getProgress() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return defaultProgress()
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {}
}

export function saveDeck(cardIds) {
  const progress = getProgress()
  progress.savedDeck = cardIds
  saveProgress(progress)
}

export function addWin(cubesEarned) {
  const progress = getProgress()
  progress.totalWins += 1
  progress.totalCubes += cubesEarned

  // Unlock new cards based on total cube count
  for (const { cubes, cardId } of UNLOCK_THRESHOLDS) {
    if (progress.totalCubes >= cubes && !progress.unlockedCards.includes(cardId)) {
      progress.unlockedCards.push(cardId)
    }
  }

  saveProgress(progress)
  return progress
}

export function addLoss() {
  const progress = getProgress()
  progress.totalLosses = (progress.totalLosses || 0) + 1
  saveProgress(progress)
}

export function resetProgress() {
  saveProgress(defaultProgress())
}

function defaultProgress() {
  return {
    totalWins: 0,
    totalLosses: 0,
    totalCubes: 0,
    unlockedCards: [...STARTER_CARD_IDS],
    savedDeck: [...DEFAULT_DECK],
  }
}

export function getAvailableCards(progress) {
  return CARDS.filter(c => progress.unlockedCards.includes(c.id))
}

export function getUnlockProgress() {
  const progress = getProgress()
  return UNLOCK_THRESHOLDS.map(t => ({
    ...t,
    unlocked: progress.totalCubes >= t.cubes,
    progress: Math.min(1, progress.totalCubes / t.cubes),
  }))
}
