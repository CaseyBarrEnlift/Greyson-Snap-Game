import Card from './Card.jsx'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import { getPlayCost } from '../engine/gameEngine.js'

export default function Hand({
  gameState,
  selectedCard,
  onSelectCard,
  onPlayCard,
  onUnplayCard,
  onEndTurn,
  onRoar,
  isRevealing,
}) {
  const { turn, energy, hands, played, roar } = gameState
  const hand = hands.player
  const playedCards = played.player

  // Get effective cost considering location (we don't know which loc yet, show base)
  function getDisplayCost(card) {
    // If already queued, show the cost at its queued location
    const queued = playedCards.find(c => c.instanceId === card.instanceId)
    if (queued) {
      const locId = gameState.locations[queued.locationIndex].id
      return getPlayCost(card, locId)
    }
    return card.cost
  }

  function canAfford(card) {
    return getDisplayCost(card) <= energy.player
  }

  function handleCardClick(card) {
    if (isRevealing) return
    if (selectedCard?.instanceId === card.instanceId) {
      onSelectCard(null)
    } else {
      onSelectCard(card)
    }
  }

  function handleUnplay(card) {
    if (isRevealing) return
    onUnplayCard(card.instanceId)
  }

  const totalQueued = playedCards.reduce((sum, c) => {
    const locId = gameState.locations[c.locationIndex].id
    return sum + getPlayCost(c, locId)
  }, 0)

  const energyLeft = energy.player

  // Build energy pips
  const maxEnergy = turn
  const usedEnergy = maxEnergy - energyLeft
  const pips = Array.from({ length: maxEnergy }, (_, i) => i < (maxEnergy - energyLeft + totalQueued) ? 'used' : i < maxEnergy - energyLeft ? 'spent' : 'filled')
  // simpler: filled = available, empty = spent
  const pipsFilled = Array.from({ length: maxEnergy }, (_, i) => i < energyLeft)

  return (
    <div className="hand-area">
      {/* Controls row */}
      <div className="controls-row">
        <div className="energy-display">
          <span className="energy-icon">⚡</span>
          <div className="energy-pips">
            {pipsFilled.map((filled, i) => (
              <div key={i} className={`energy-pip ${filled ? 'filled' : ''}`} />
            ))}
          </div>
        </div>

        <div className="turn-dots">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={`turn-dot ${i < turn - 1 ? 'done' : i === turn - 1 ? 'current' : ''}`}
            />
          ))}
        </div>

        <span className={`phase-indicator ${isRevealing ? 'revealing' : ''}`}>
          {isRevealing ? 'Revealing…' : `Turn ${turn}`}
        </span>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!roar.playerUsed && !isRevealing && (
            <button className="btn-roar" onClick={onRoar} title="Double the stakes!">
              🦁 Roar!
            </button>
          )}

          <button
            className="btn-end-turn"
            onClick={onEndTurn}
            disabled={isRevealing}
          >
            End Turn
          </button>
        </div>
      </div>

      {/* Queued plays */}
      {playedCards.length > 0 && (
        <div className="played-queue-area">
          <span className="hand-label">Playing:</span>
          {playedCards.map(card => {
            const locIdx = card.locationIndex
            const locDef = LOCATIONS_BY_ID[gameState.locations[locIdx].id]
            const cost = getPlayCost(card, locDef.id)
            return (
              <div
                key={card.instanceId}
                className="played-card-entry"
                onClick={() => handleUnplay(card)}
                title="Click to cancel"
              >
                <span>{LOCATIONS_BY_ID[gameState.locations[locIdx].id]?.emoji}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {LOCATIONS_BY_ID[gameState.locations[locIdx].id]?.name}
                </span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                  ✕
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Hand cards */}
      <div className="hand-row">
        <span className="hand-label">Hand ({hand.length})</span>
        {hand.map(card => (
          <Card
            key={card.instanceId}
            card={card}
            gameState={gameState}
            locationIndex={null}
            owner="player"
            variant="hand"
            selected={selectedCard?.instanceId === card.instanceId}
            onClick={() => handleCardClick(card)}
            showTooltip
          />
        ))}
        {hand.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No cards in hand</span>
        )}
      </div>
    </div>
  )
}
