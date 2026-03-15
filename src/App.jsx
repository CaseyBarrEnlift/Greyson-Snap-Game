import { useReducer, useState } from 'react'
import './App.css'
import { gameReducer } from './engine/gameEngine.js'
import { getProgress } from './utils/storage.js'
import { DEFAULT_DECK } from './data/cards.js'
import MainMenu from './components/MainMenu.jsx'
import GameBoard from './components/GameBoard.jsx'
import GameOver from './components/GameOver.jsx'
import DeckBuilder from './components/DeckBuilder.jsx'
import Collection from './components/Collection.jsx'

// AI uses a varied deck selection
function buildAIDeck() {
  const aiDecks = [
    // Ocean combo
    ['shark', 'dolphin', 'whale', 'flamingo', 'penguin', 'eagle', 'owl', 'frog', 'giraffe', 'cobra', 'rhino', 'bear'],
    // Big cat aggro
    ['lion', 'tiger', 'cheetah', 'gorilla', 'elephant', 'hippo', 'bear', 'rhino', 'cobra', 'owl', 'giraffe', 'flamingo'],
    // Control/disruption
    ['crocodile', 'hippo', 'gorilla', 'cobra', 'elephant', 'whale', 'rhino', 'bear', 'tiger', 'parrot', 'frog', 'owl'],
    // Swarm birds
    ['flamingo', 'penguin', 'eagle', 'owl', 'parrot', 'frog', 'giraffe', 'dolphin', 'shark', 'rhino', 'bear', 'cobra'],
  ]
  return aiDecks[Math.floor(Math.random() * aiDecks.length)]
}

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [gameState, dispatch] = useReducer(gameReducer, null)

  function startGame() {
    const progress = getProgress()
    const playerDeck = progress.savedDeck?.length === 12
      ? progress.savedDeck
      : [...DEFAULT_DECK]
    const aiDeck = buildAIDeck()

    dispatch({ type: 'INIT_GAME', playerDeck, aiDeck })
    setScreen('game')
  }

  function handleGameOver() {
    setScreen('gameover')
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          onPlay={startGame}
          onDeckBuilder={() => setScreen('deckbuilder')}
          onCollection={() => setScreen('collection')}
        />
      )}

      {screen === 'game' && gameState && (
        <GameBoard
          gameState={gameState}
          dispatch={dispatch}
          onGameOver={handleGameOver}
        />
      )}

      {screen === 'gameover' && gameState && (
        <GameOver
          gameState={gameState}
          onPlayAgain={startGame}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilder onBack={() => setScreen('menu')} />
      )}

      {screen === 'collection' && (
        <Collection onBack={() => setScreen('menu')} />
      )}
    </div>
  )
}
