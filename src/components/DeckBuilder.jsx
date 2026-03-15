import { useState } from 'react'
import { CARDS, CARDS_BY_ID } from '../data/cards.js'
import { getProgress, saveDeck } from '../utils/storage.js'
import Card from './Card.jsx'

const DECK_SIZE = 12

export default function DeckBuilder({ onBack }) {
  const progress = getProgress()
  const [deck, setDeck] = useState(() => [...(progress.savedDeck || [])])
  const [saved, setSaved] = useState(false)

  const unlockedIds = new Set(progress.unlockedCards)

  function toggleCard(cardId) {
    if (!unlockedIds.has(cardId)) return
    setDeck(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId)
      } else if (prev.length < DECK_SIZE) {
        return [...prev, cardId]
      }
      return prev
    })
    setSaved(false)
  }

  function handleSave() {
    if (deck.length !== DECK_SIZE) return
    saveDeck(deck)
    setSaved(true)
  }

  const isValid = deck.length === DECK_SIZE

  return (
    <div className="screen deckbuilder-screen">
      <div className="screen-header">
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          ← Back
        </button>
        <span className="screen-title">Deck Builder</span>
        <button
          className={`btn ${isValid ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleSave}
          disabled={!isValid}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          {saved ? '✓ Saved' : 'Save Deck'}
        </button>
      </div>

      <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="deck-info">
          Cards in deck:{' '}
          <span className={`deck-count ${isValid ? 'valid' : 'invalid'}`}>
            {deck.length}/{DECK_SIZE}
          </span>
          {deck.length > 0 && deck.length < DECK_SIZE && (
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              ({DECK_SIZE - deck.length} more needed)
            </span>
          )}
        </div>

        {/* Current deck preview */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {deck.map(id => {
            const def = CARDS_BY_ID[id]
            return (
              <div
                key={id}
                onClick={() => toggleCard(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'var(--bg-location)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '4px',
                  padding: '0.15rem 0.4rem',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
                title="Click to remove"
              >
                <span>{def.emoji}</span>
                <span>{def.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="screen-body">
        <div className="card-grid">
          {CARDS.map(cardDef => {
            const unlocked = unlockedIds.has(cardDef.id)
            const inDeck = deck.includes(cardDef.id)
            return (
              <div
                key={cardDef.id}
                className={`card-grid-item ${inDeck ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}
                onClick={() => toggleCard(cardDef.id)}
                title={unlocked ? cardDef.abilityText : `Unlock at ${cardDef.unlockCubes} cubes`}
              >
                <Card
                  card={{
                    instanceId: cardDef.id,
                    cardId: cardDef.id,
                    cost: cardDef.cost,
                    power: cardDef.basePower,
                    modifiers: [],
                    revealed: true,
                    locationIndex: null,
                    copiedAbility: null,
                  }}
                  variant="normal"
                  showTooltip={false}
                />
                <div className="card-select-overlay" />
                {!unlocked && (
                  <div className="card-lock-badge">🔒</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
