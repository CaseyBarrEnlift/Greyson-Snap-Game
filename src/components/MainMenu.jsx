import { getProgress } from '../utils/storage.js'

export default function MainMenu({ onPlay, onDeckBuilder, onCollection }) {
  const progress = getProgress()

  return (
    <div className="screen menu-screen">
      <div className="menu-title">Animal Snap</div>
      <div className="menu-subtitle">The wild card battle</div>

      <div className="menu-stats">
        <div className="menu-stat">
          <div className="menu-stat-value">{progress.totalWins}</div>
          <div className="menu-stat-label">Wins</div>
        </div>
        <div className="menu-stat">
          <div className="menu-stat-value">{progress.totalCubes}</div>
          <div className="menu-stat-label">Cubes</div>
        </div>
        <div className="menu-stat">
          <div className="menu-stat-value">{progress.unlockedCards.length}</div>
          <div className="menu-stat-label">Cards</div>
        </div>
      </div>

      <div className="menu-buttons">
        <button className="btn btn-primary" onClick={onPlay}>
          🎮 Play Game
        </button>
        <button className="btn btn-secondary" onClick={onDeckBuilder}>
          🃏 Deck Builder
        </button>
        <button className="btn btn-secondary" onClick={onCollection}>
          📚 Collection
        </button>
      </div>

      <div style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'center' }}>
        Win games to unlock new cards • Use Roar to double stakes
      </div>
    </div>
  )
}
