import { CARDS } from '../data/cards.js'
import { getProgress, getUnlockProgress } from '../utils/storage.js'
import Card from './Card.jsx'

export default function Collection({ onBack }) {
  const progress = getProgress()
  const unlockProgress = getUnlockProgress()
  const unlockedIds = new Set(progress.unlockedCards)

  const grouped = {
    common: CARDS.filter(c => c.rarity === 'common'),
    uncommon: CARDS.filter(c => c.rarity === 'uncommon'),
    rare: CARDS.filter(c => c.rarity === 'rare'),
  }

  return (
    <div className="screen collection-screen">
      <div className="screen-header">
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          ← Back
        </button>
        <span className="screen-title">Collection</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {unlockedIds.size}/{CARDS.length} cards
        </span>
      </div>

      {/* Unlock progress */}
      <div className="unlock-progress">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Unlock Progress • {progress.totalCubes} cubes
        </div>
        {unlockProgress.map(item => (
          <div key={item.cardId} className="unlock-item">
            <span style={{ fontSize: '0.7rem', color: item.unlocked ? 'var(--accent-green)' : 'var(--text-secondary)', minWidth: '80px' }}>
              {item.unlocked ? '✓' : `${item.cubes}🎲`} {item.cardId}
            </span>
            <div className="unlock-bar">
              <div
                className="unlock-bar-fill"
                style={{ width: `${item.progress * 100}%`, background: item.unlocked ? 'var(--accent-green)' : 'var(--accent-gold)' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="screen-body">
        {Object.entries(grouped).map(([rarity, cards]) => (
          <div key={rarity} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
              {rarity}
            </div>
            <div className="card-grid">
              {cards.map(cardDef => {
                const unlocked = unlockedIds.has(cardDef.id)
                return (
                  <div
                    key={cardDef.id}
                    className={`card-grid-item ${!unlocked ? 'locked' : ''}`}
                    title={unlocked ? cardDef.abilityText : `Unlock at ${cardDef.unlockCubes ?? 0} cubes`}
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
                      showTooltip
                    />
                    {!unlocked && (
                      <div className="card-lock-badge">🔒</div>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.25rem', padding: '0 0.25rem', lineHeight: '1.3' }}>
                      {unlocked ? cardDef.abilityText : `${cardDef.unlockCubes ?? 0} cubes to unlock`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
