import { useEffect, useRef, useState } from 'react'
import { computeAIPlay, shouldAIRoar, shouldAIAcceptRoar } from '../engine/ai.js'
import { calculateAllScores, checkWinCondition } from '../engine/gameEngine.js'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import Location from './Location.jsx'
import Hand from './Hand.jsx'

const REVEAL_CARD_DELAY = 350     // ms between each card flip
const EFFECT_APPLY_DELAY = 200   // ms after flip before on-reveal fires
const BETWEEN_TURN_DELAY = 800   // ms after all reveals before next turn

export default function GameBoard({ gameState, dispatch, onGameOver }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [roarModal, setRoarModal] = useState(null)  // { type: 'player-roar' | 'ai-roar' }
  const revealRef = useRef(false)

  // Watch for reveal phase
  useEffect(() => {
    if (gameState.phase === 'reveal' && !revealRef.current) {
      revealRef.current = true
      runRevealSequence()
    }
  }, [gameState.phase]) // eslint-disable-line

  // Watch for game over
  useEffect(() => {
    if (gameState.gameOver) {
      onGameOver()
    }
  }, [gameState.gameOver]) // eslint-disable-line

  // Watch for AI roar opportunity (at end of play phase, before committing)
  // Actually we'll check during commit

  async function runRevealSequence() {
    setIsRevealing(true)

    // Collect all cards that need revealing across all locations
    const allToReveal = []
    for (let locIdx = 0; locIdx < 3; locIdx++) {
      const locState = gameState.locations[locIdx]
      const locDef = LOCATIONS_BY_ID[locState.id]
      const reversed = locDef.effectType === 'reversed-reveal'

      // player cards then ai cards (or reversed)
      const sides = reversed ? ['ai', 'player'] : ['player', 'ai']
      for (const owner of sides) {
        for (const card of locState.cards[owner]) {
          if (!card.revealed) {
            allToReveal.push({ card, locIdx, owner })
          }
        }
      }
    }

    // Reveal each card with stagger
    for (const { card, locIdx, owner } of allToReveal) {
      await delay(REVEAL_CARD_DELAY)
      dispatch({ type: 'REVEAL_CARD', instanceId: card.instanceId })
      await delay(EFFECT_APPLY_DELAY)
      dispatch({ type: 'APPLY_ON_REVEAL', instanceId: card.instanceId, locationIndex: locIdx, owner })
      dispatch({ type: 'UPDATE_SCORES' })
    }

    // After all reveals, trigger turn-end effects & advance turn
    await delay(BETWEEN_TURN_DELAY)

    // Check if game is over
    if (gameState.turn >= 6) {
      const winner = checkWinCondition(gameState)
      dispatch({ type: 'NEXT_TURN', winner })
    } else {
      dispatch({ type: 'NEXT_TURN' })
    }

    setIsRevealing(false)
    revealRef.current = false
    setSelectedCard(null)
  }

  function handleEndTurn() {
    if (isRevealing) return

    // Compute AI play
    const aiPlays = computeAIPlay(gameState)

    // Check if AI wants to Roar
    if (!gameState.roar.aiUsed && !gameState.roar.playerUsed && shouldAIRoar(gameState)) {
      dispatch({ type: 'AI_ROAR' })
      setRoarModal({ type: 'ai-roar' })
      return
    }

    // Commit turn
    dispatch({ type: 'COMMIT_TURN', aiPlays })
    setSelectedCard(null)
  }

  function handlePlayerRoar() {
    dispatch({ type: 'ROAR' })
    // AI responds
    if (shouldAIAcceptRoar(gameState)) {
      dispatch({ type: 'ACCEPT_ROAR' })
      // Show brief "AI Accepted" message
      setRoarModal({ type: 'ai-accepted' })
      setTimeout(() => setRoarModal(null), 1500)
    } else {
      // AI retreats — they lose
      dispatch({ type: 'RETREAT' })
    }
  }

  function handlePlayerAcceptRoar() {
    dispatch({ type: 'ACCEPT_ROAR' })
    setRoarModal(null)
    // Now commit the turn (AI already decided to roar)
    const aiPlays = computeAIPlay(gameState)
    dispatch({ type: 'COMMIT_TURN', aiPlays })
    setSelectedCard(null)
  }

  function handlePlayerRetreat() {
    setRoarModal(null)
    dispatch({ type: 'RETREAT' })
  }

  function handlePlayCard(instanceId, locationIndex) {
    if (isRevealing) return
    dispatch({ type: 'PLAY_CARD', instanceId, locationIndex })
    setSelectedCard(null)
  }

  function handleUnplayCard(instanceId) {
    dispatch({ type: 'UNPLAY_CARD', instanceId })
  }

  function handleDropCard(instanceId, locationIndex) {
    handlePlayCard(instanceId, locationIndex)
  }

  const { roar, scores } = gameState
  const isStakesElevated = roar.stakes > 1

  return (
    <div className="game-screen screen">
      {/* Header */}
      <div className="game-header">
        <div className="game-header-left">
          <span className="turn-indicator">Turn</span>
          <span className="turn-number">{gameState.turn}/6</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className={`stakes-display ${isStakesElevated ? 'elevated' : ''}`}>
            <span>🎲</span>
            <span className="stakes-value">×{roar.stakes}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>stakes</span>
          </div>
        </div>

        <div className="game-header-right">
          <button
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
            onClick={() => {
              if (window.confirm('Forfeit this game?')) {
                dispatch({ type: 'RETREAT' })
              }
            }}
          >
            Forfeit
          </button>
        </div>
      </div>

      {/* Main board */}
      <div className="game-main">
        <div className="locations-row">
          {gameState.locations.map((locState, i) => (
            <Location
              key={locState.id}
              locationIndex={i}
              locState={locState}
              gameState={gameState}
              selectedCard={selectedCard}
              onDropCard={handleDropCard}
              onClickSide={(instanceId, locIdx) => handlePlayCard(instanceId, locIdx)}
            />
          ))}
        </div>
      </div>

      {/* Hand + controls */}
      <Hand
        gameState={gameState}
        selectedCard={selectedCard}
        onSelectCard={setSelectedCard}
        onPlayCard={handlePlayCard}
        onUnplayCard={handleUnplayCard}
        onEndTurn={handleEndTurn}
        onRoar={handlePlayerRoar}
        isRevealing={isRevealing}
      />

      {/* Roar modal - AI roared at player */}
      {roarModal?.type === 'ai-roar' && (
        <div className="modal-overlay">
          <div className="modal roar-modal">
            <div className="modal-icon">🦁</div>
            <div className="modal-title">The AI Roars!</div>
            <div className="modal-body">
              Stakes doubled to <strong style={{ color: 'var(--accent-gold)' }}>×{gameState.roar.stakes}</strong>!<br />
              Do you accept the challenge or retreat?
            </div>
            <div className="modal-buttons">
              <button className="btn btn-danger" onClick={handlePlayerRetreat}>
                Retreat (lose ×{Math.floor(gameState.roar.stakes / 2)})
              </button>
              <button className="btn btn-primary" onClick={handlePlayerAcceptRoar}>
                Accept! 💪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brief AI-accepted notification */}
      {roarModal?.type === 'ai-accepted' && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal">
            <div className="modal-icon">😤</div>
            <div className="modal-title">AI Accepts!</div>
            <div className="modal-body">The stakes are now ×{gameState.roar.stakes}. Game on!</div>
          </div>
        </div>
      )}
    </div>
  )
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
