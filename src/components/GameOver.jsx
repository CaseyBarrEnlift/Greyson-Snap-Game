import { useEffect, useState } from 'react'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import { calculateAllScores } from '../engine/gameEngine.js'
import { addWin, addLoss, getProgress } from '../utils/storage.js'

export default function GameOver({ gameState, onPlayAgain, onMenu }) {
  const [newUnlocks, setNewUnlocks] = useState([])
  const [progressAfter, setProgressAfter] = useState(null)

  const { winner, roar, retreated, locations } = gameState
  const scores = calculateAllScores(gameState)

  const playerWon = winner === 'player'
  const isDraw = winner === 'draw'
  const cubesEarned = playerWon ? roar.stakes : 0

  useEffect(() => {
    if (playerWon) {
      const before = getProgress()
      const after = addWin(cubesEarned)
      const newCards = after.unlockedCards.filter(id => !before.unlockedCards.includes(id))
      setNewUnlocks(newCards)
      setProgressAfter(after)
    } else {
      addLoss()
    }
  }, []) // eslint-disable-line

  const titles = {
    player: '🏆 Victory!',
    ai: '💀 Defeat',
    draw: '🤝 Draw',
  }

  const titleClasses = {
    player: 'win',
    ai: 'lose',
    draw: 'draw',
  }

  return (
    <div className="screen gameover-screen">
      <div className="gameover-icon">{playerWon ? '🦁' : isDraw ? '🦊' : '🐺'}</div>

      <div className={`gameover-title ${titleClasses[winner]}`}>
        {titles[winner]}
      </div>

      {retreated && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {retreated === 'player' ? 'You retreated.' : 'The AI retreated!'}
        </div>
      )}

      {/* Location scores */}
      <div className="gameover-scores">
        {locations.map((loc, i) => {
          const locDef = LOCATIONS_BY_ID[loc.id]
          const p = scores.player[i]
          const a = scores.ai[i]
          const result = p > a ? 'win' : a > p ? 'lose' : 'draw'
          return (
            <div key={loc.id} className={`gameover-loc-score ${result}`}>
              <div className="gameover-loc-name">
                {locDef.emoji} {locDef.name}
              </div>
              <div className="gameover-loc-values">
                <span style={{ color: 'var(--accent-blue)' }}>{p}</span>
                {' – '}
                <span style={{ color: 'var(--accent-red)' }}>{a}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cubes */}
      {playerWon && (
        <div style={{ textAlign: 'center' }}>
          <div className="cubes-earned">+{cubesEarned} 🎲</div>
          <div className="cubes-label">
            cubes earned
            {progressAfter && ` • Total: ${progressAfter.totalCubes}`}
          </div>
        </div>
      )}

      {/* New unlocks */}
      {newUnlocks.length > 0 && (
        <div className="unlock-announce">
          <div className="unlock-announce-text">
            🎉 New card{newUnlocks.length > 1 ? 's' : ''} unlocked!{' '}
            {newUnlocks.join(', ')}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button className="btn btn-secondary" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  )
}
