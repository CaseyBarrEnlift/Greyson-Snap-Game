import { useState } from 'react'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import { calculateLocationScore } from '../engine/gameEngine.js'
import Card from './Card.jsx'

export default function Location({
  locationIndex,
  locState,
  gameState,
  selectedCard,
  onDropCard,
  onClickSide,
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const locDef = LOCATIONS_BY_ID[locState.id]

  const playerScore = calculateLocationScore(locationIndex, 'player', gameState)
  const aiScore = calculateLocationScore(locationIndex, 'ai', gameState)

  let playerClass = 'tied'
  let aiClass = 'tied'
  if (playerScore > aiScore) { playerClass = 'winning'; aiClass = 'losing' }
  else if (aiScore > playerScore) { aiClass = 'winning'; playerClass = 'losing' }

  // Cave location hides AI cards from player until turn 6
  const hideCaveCards = locDef.effectType === 'hide-until-end' && gameState.turn < 6

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const instanceId = e.dataTransfer.getData('instanceId')
    if (instanceId && onDropCard) onDropCard(instanceId, locationIndex)
  }

  function handleClickSide() {
    if (selectedCard && onClickSide) onClickSide(selectedCard.instanceId, locationIndex)
  }

  return (
    <div
      className="location"
      style={{ '--loc-gradient': locDef.gradient }}
    >
      {/* Location header */}
      <div
        className="location-header"
        style={{ background: locDef.gradient, backgroundSize: '200% 200%' }}
      >
        <span className="location-emoji">{locDef.emoji}</span>
        <span className="location-name">{locDef.name}</span>
        <div
          className="location-effect-icon"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          ℹ
          {showTooltip && (
            <div className="location-effect-tooltip">
              {locDef.effectText}
            </div>
          )}
        </div>
      </div>

      {/* Score row */}
      <div className="location-score-row">
        <span className={`loc-score ${aiClass}`}>{aiScore}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>vs</span>
        <span className={`loc-score ${playerClass}`}>{playerScore}</span>
      </div>

      <div className="location-divider" />

      {/* AI side */}
      <div className="location-side ai-side">
        <div className="location-side-label">AI</div>
        <div className="location-cards">
          {locState.cards.ai.map(card => (
            <Card
              key={card.instanceId}
              card={card}
              gameState={gameState}
              locationIndex={locationIndex}
              owner="ai"
              variant="small"
              faceDown={!card.revealed || hideCaveCards}
              showTooltip
            />
          ))}
        </div>
      </div>

      <div className="location-divider" />

      {/* Player side — drop target */}
      <div
        className={`location-side player-side${isDragOver ? ' drop-target' : ''}`}
        onClick={handleClickSide}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="location-cards">
          {locState.cards.player.map(card => (
            <Card
              key={card.instanceId}
              card={card}
              gameState={gameState}
              locationIndex={locationIndex}
              owner="player"
              variant="small"
              faceDown={!card.revealed}
              showTooltip
            />
          ))}
        </div>
        {locState.cards.player.length === 0 && (
          <div className="player-side-hint">Drag here<br />or click to play</div>
        )}
        <div className="location-side-label">YOU</div>
      </div>
    </div>
  )
}
