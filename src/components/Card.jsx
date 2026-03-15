import { useState, useEffect, useRef } from 'react'
import { CARDS_BY_ID } from '../data/cards.js'
import { calculatePower } from '../engine/gameEngine.js'

function usePrevious(value) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref.current
}

export default function Card({
  card,
  gameState,
  locationIndex,
  owner,
  variant = 'normal',   // 'normal' | 'small' | 'hand'
  selected = false,
  queued = false,
  faceDown = false,
  onClick,
  showTooltip = false,
}) {
  const [flashClass, setFlashClass] = useState('')
  const [animClass, setAnimClass] = useState('')
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const tooltipTimer = useRef(null)

  const cardDef = CARDS_BY_ID[card.cardId]

  // Compute displayed power
  const displayPower = (gameState && locationIndex !== null && locationIndex !== undefined && owner && card.revealed)
    ? calculatePower(card, locationIndex, owner, gameState)
    : card.power + card.modifiers.reduce((s, m) => s + m.amount, 0)

  const prevPower = usePrevious(displayPower)

  // Flash on power change
  useEffect(() => {
    if (prevPower === undefined || prevPower === displayPower) return
    const cls = displayPower > prevPower ? 'flash-up' : 'flash-down'
    setFlashClass(cls)
    const t = setTimeout(() => setFlashClass(''), 500)
    return () => clearTimeout(t)
  }, [displayPower]) // eslint-disable-line

  // Slide-in animation when card lands on board
  useEffect(() => {
    if (card.locationIndex !== null && !card.revealed) {
      setAnimClass('card--playing')
      const t = setTimeout(() => setAnimClass(''), 400)
      return () => clearTimeout(t)
    }
  }, [card.locationIndex]) // eslint-disable-line

  // Flip animation when revealed
  useEffect(() => {
    if (card.revealed) {
      setAnimClass('card--revealing')
      const t = setTimeout(() => setAnimClass('card--on-board'), 600)
      return () => clearTimeout(t)
    }
  }, [card.revealed]) // eslint-disable-line

  function handleMouseEnter() {
    if (!showTooltip) return
    tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 400)
  }

  function handleMouseLeave() {
    clearTimeout(tooltipTimer.current)
    setTooltipVisible(false)
  }

  const ability = card.copiedAbility || cardDef.ability
  const abilityBadge = ability?.type === 'on-reveal' ? 'OR' : ability?.type === 'ongoing' ? 'OG' : null
  const abilityBadgeClass = ability?.type === 'on-reveal' ? 'on-reveal' : 'ongoing'

  const classNames = [
    'card',
    variant === 'small' ? 'card--small' : '',
    variant === 'hand' ? 'card--in-hand' : '',
    selected ? 'card--selected' : '',
    queued ? 'card--queued' : '',
    faceDown ? 'card--face-down' : '',
    animClass,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={variant === 'hand'}
      onDragStart={e => {
        e.dataTransfer.setData('instanceId', card.instanceId)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="card-inner">
        {/* Back face */}
        <div className="card-back">🐾</div>

        {/* Front face */}
        <div className={`card-front rarity-${cardDef.rarity}`}>
          <div className="card-cost">{card.cost}</div>

          {abilityBadge && (
            <div className={`card-ability-badge ${abilityBadgeClass}`}>{abilityBadge}</div>
          )}

          <div className="card-emoji">{cardDef.emoji}</div>

          {variant !== 'small' && (
            <div className="card-name">{cardDef.name}</div>
          )}

          <div className={`card-power ${flashClass}`}>{displayPower}</div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipVisible && (
        <div className="card-tooltip">
          <div className="card-tooltip-name">{cardDef.name}</div>
          {ability && (
            <div className="card-tooltip-ability">
              {card.copiedAbility
                ? `[Copied] ${ability.effect}`
                : cardDef.abilityText}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
