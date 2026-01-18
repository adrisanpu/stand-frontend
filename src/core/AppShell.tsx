import { useEffect, useState } from 'react'
import { ThemeProvider } from './theme'
import GameGate from './GameGate'
import SettingsMenu from './SettingsMenu'
import Ranking from './Ranking'
import Players from './Players'
import RaffleData from './RaffleData'
import { getGameById } from '../games'
import type { GameDefinition } from './types'
import { useCurrentUser } from '../auth/useCurrentUser'

const STORAGE_KEY_LOGO = 'app_custom_logo'

export default function AppShell() {
  const { loading: userLoading } = useCurrentUser()
  const [showSettings, setShowSettings] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameName, setGameName] = useState<string | null>(null)
  const [gameType, setGameType] = useState<string | null>(null)
  const [gameDefinition, setGameDefinition] = useState<GameDefinition | null>(null)
  const [customLogo, setCustomLogo] = useState<string | null>(null)

  // Load custom logo from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO)
    if (saved) {
      setCustomLogo(saved)
    }
  }, [])

  // Load gameId, gameName, and gameType from localStorage on mount
  useEffect(() => {
    const savedGameId = localStorage.getItem('gameId')
    const savedGameName = localStorage.getItem('gameName')
    const savedGameType = localStorage.getItem('gameType')
    
    if (savedGameId && savedGameName) {
      setGameId(savedGameId)
      setGameName(savedGameName)
      
      // Try to load game definition using saved gameType or extract from gameId
      const gameIdToUse = savedGameType || savedGameId.split('_')[0]?.toLowerCase()
      if (gameIdToUse) {
        const game = getGameById(gameIdToUse)
        if (game) {
          setGameDefinition(game)
          setGameType(gameIdToUse)
        }
      }
    }
    // No default game - start with catalog
  }, [])

  // Persist gameId, gameName, and gameType on change
  useEffect(() => {
    if (gameId) {
      localStorage.setItem('gameId', gameId)
    } else {
      localStorage.removeItem('gameId')
    }
  }, [gameId])

  useEffect(() => {
    if (gameName) {
      localStorage.setItem('gameName', gameName)
    } else {
      localStorage.removeItem('gameName')
    }
  }, [gameName])

  useEffect(() => {
    if (gameType) {
      localStorage.setItem('gameType', gameType)
    } else {
      localStorage.removeItem('gameType')
    }
  }, [gameType])

  // Update game definition when gameType changes
  useEffect(() => {
    if (gameType) {
      const game = getGameById(gameType)
      if (game) {
        setGameDefinition(game)
      }
    }
  }, [gameType])

  // Map game type names to game IDs
  const mapGameTypeToId = (type: string | undefined): string => {
    if (!type) return 'empareja2'
    const normalized = type.toLowerCase()
    // Map common variations
    if (normalized === 't1mer' || normalized === 'timer') return 't1mer'
    if (normalized === 'empareja2' || normalized === 'empareja') return 'empareja2'
    if (normalized === 'rulet4' || normalized === 'ruleta') return 'rulet4'
    return normalized
  }

  const handleGameCreated = (name: string, id: string, type?: string) => {
    setGameName(name)
    setGameId(id)
    const gameIdToUse = mapGameTypeToId(type)
    setGameType(gameIdToUse)
  }

  const handleSetGameId = (id: string) => {
    setGameId(id)
  }

  const handleLeaveGame = () => {
    setGameId(null)
    setGameName(null)
    setGameType(null)
    setGameDefinition(null)
    setShowSettings(false)
  }

  const handleExitApp = () => {
    // Clear all localStorage
    localStorage.clear()
    // Optionally reload the page or close the app
    window.location.reload()
  }

  // Use game definition if available, otherwise use a default theme (no specific game)
  const currentGame = gameDefinition

  // Show loading state while fetching user
  if (userLoading) {
    return (
      <ThemeProvider game={currentGame}>
        <div className="bg-club text-textMain font-sans min-h-screen flex items-center justify-center px-6">
          <div className="card w-full max-w-md p-8 text-center">
            <p className="text-textMain">Cargando...</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider game={currentGame}>
      <div className="bg-club text-textMain font-sans">
        {/* Settings Icon */}
        <button
          onClick={() => setShowSettings(true)}
          className="fixed top-4 left-4 z-40 p-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-black/30 transition-all duration-200"
          aria-label="Configuración"
        >
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="min-h-screen grid place-items-center px-6">
          {gameId && gameName && currentGame ? (
            /* Game Screen with sidebar components */
            <div className="flex gap-4 w-full max-w-6xl items-start">
              {/* Game Screen */}
              <div className="card flex-1 p-8">
                {/* Game logo and custom logo shown when a game is selected */}
                {(currentGame.assets?.logo || customLogo) && (
                  <div className="flex flex-col items-center mb-8 gap-4">
                    {customLogo && (
                      <img 
                        src={customLogo} 
                        alt="Logo personalizado" 
                        className="h-16 w-auto object-contain"
                      />
                    )}
                    {currentGame.assets?.logo && (
                      <img 
                        src={currentGame.assets.logo} 
                        alt={currentGame.name} 
                        className="h-[120px] w-auto object-contain"
                      />
                    )}
                  </div>
                )}
                <currentGame.GameScreen gameName={gameName} gameId={gameId} />
              </div>
              
              {/* Sidebar: Players, Ranking (if enabled), RaffleData */}
              <div className="w-64 flex-shrink-0 space-y-4">
                <Players gameId={gameId} />
                {currentGame.showRanking && (
                  <Ranking gameId={gameId} />
                )}
                <RaffleData gameId={gameId} />
              </div>
            </div>
          ) : (
            /* GameGate Catalog */
            <div className="card w-full max-w-md p-8">
              <GameGate 
                onGameCreated={handleGameCreated} 
                onSetGameId={handleSetGameId}
              />
            </div>
          )}
        </div>

        {/* Settings Menu */}
        {showSettings && (
          <SettingsMenu 
            onClose={() => setShowSettings(false)} 
            gameId={gameId ?? undefined}
            gameType={gameType ?? undefined}
            gameDefinition={gameDefinition ?? undefined}
            onLeaveGame={handleLeaveGame}
            onExitApp={handleExitApp}
          />
        )}

        {/* Logo fijo - always visible in bottom right corner */}
        <div className="fixed right-4 bottom-4 opacity-80 hover:opacity-100 transition-opacity z-10">
          <img 
            src={customLogo || '/stand-logo.png'} 
            alt={customLogo ? "Logo personalizado" : "Stand"} 
            className="w-14 h-14 object-contain" 
          />
        </div>
      </div>
    </ThemeProvider>
  )
}

