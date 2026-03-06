import { useEffect, useState, useRef } from 'react'
import { ThemeProvider } from './theme'
import GameGate from './GameGate'
import SettingsMenu from './SettingsMenu'
import Ranking from './Ranking'
import Players from './Players'
import RaffleData from './RaffleData'
import { getGameById } from '../games'
import type { GameDefinition } from './types'
import { useCurrentUser } from '../auth/useCurrentUser'
import { useOrientation } from '../hooks/useOrientation'

const STORAGE_KEY_LOGO = 'app_custom_logo'

// Logo size on game screens (portrait and landscape) — larger across breakpoints
const GAME_SCREEN_LOGO_CLASS = 'h-32 sm:h-36 lg:h-40 xl:h-44 2xl:h-52 w-auto object-contain'
// Letras overlapping bottom half of logo, larger than logo
const GAME_SCREEN_LETRAS_CLASS = 'h-40 sm:h-44 lg:h-48 xl:h-52 2xl:h-60 w-auto object-contain -mt-24 sm:-mt-28 lg:-mt-32 xl:-mt-36 2xl:-mt-40'
// Landscape: letras closer to logo (stronger negative margin)
const GAME_SCREEN_LETRAS_CLASS_LANDSCAPE = 'h-40 sm:h-44 lg:h-48 xl:h-52 2xl:h-60 w-auto object-contain -mt-28 sm:-mt-32 lg:-mt-36 xl:-mt-40 2xl:-mt-44'

export default function AppShell() {
  const { loading: userLoading } = useCurrentUser()
  const [showSettings, setShowSettings] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameName, setGameName] = useState<string | null>(null)
  const [gameType, setGameType] = useState<string | null>(null)
  const [gameDefinition, setGameDefinition] = useState<GameDefinition | null>(null)
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const [gameConfigVersion, setGameConfigVersion] = useState(0)
  const portraitContentRef = useRef<HTMLDivElement>(null)
  const landscapeContentRef = useRef<HTMLDivElement>(null)
  const [portraitPaddingDvh, setPortraitPaddingDvh] = useState(10)
  const [landscapeScale, setLandscapeScale] = useState(1)
  const [landscapeContentSize, setLandscapeContentSize] = useState<{ width: number; height: number } | null>(null)

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
    if (normalized === 'cupido') return 'cupido'
    if (normalized === 'semaforo' || normalized === 'semáforo') return 'semaforo'
    if (normalized === 'infocards') return 'infocards'
    return normalized
  }

  const handleGameCreated = (name: string, id: string, type?: string) => {
    setGameName(name)
    setGameId(id)
    const gameIdToUse = mapGameTypeToId(type)
    setGameType(gameIdToUse)
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
  const isPortrait = useOrientation()

  // Portrait: reduce top/bottom padding when content overflows (e.g. Sorteo with countdown) so nothing is hidden
  useEffect(() => {
    if (!isPortrait) {
      setPortraitPaddingDvh(10)
      return
    }
    const el = portraitContentRef.current
    if (!el) return
    const HYSTERESIS_PX = 40
    const checkOverflow = () => {
      const sh = el.scrollHeight
      const vh = window.innerHeight
      setPortraitPaddingDvh((prev) => {
        if (sh > vh) return 5
        if (sh <= vh - HYSTERESIS_PX) return 10
        return prev
      })
    }
    checkOverflow()
    const ro = new ResizeObserver(checkOverflow)
    ro.observe(el)
    window.addEventListener('resize', checkOverflow)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', checkOverflow)
    }
  }, [isPortrait, gameId, gameConfigVersion])

  // Scale-to-fit in landscape: content fits in the central 80% (10% air each side and top/bottom)
  useEffect(() => {
    if (isPortrait) {
      setLandscapeScale(1)
      setLandscapeContentSize(null)
      return
    }
    const el = landscapeContentRef.current
    if (!el) return
    const updateScale = () => {
      const sh = el.scrollHeight
      const sw = el.scrollWidth
      const vh = window.innerHeight
      const vw = window.innerWidth
      const availableW = vw * 0.8
      const availableH = vh * 0.8
      setLandscapeContentSize({ width: sw, height: sh })
      let scale = Math.min(1, availableH / sh, availableW / sw)
      if (sh <= availableH && sw <= availableW) scale = Math.min(scale, 0.85)
      scale = Math.min(scale, 0.9)
      setLandscapeScale(scale)
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    window.addEventListener('resize', updateScale)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [isPortrait, gameId, gameConfigVersion])
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
          className={`fixed top-4 left-4 z-40 p-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-black/30 transition-all duration-200 flex items-center justify-center ${isPortrait ? 'min-w-[44px] min-h-[44px]' : 'min-w-[36px] min-h-[36px]'}`}
          aria-label="Configuración"
        >
          <svg className={`${isPortrait ? 'w-6 h-6 lg:w-7 lg:h-7' : 'w-5 h-5'} text-white/70`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className={gameId && gameName && currentGame ? 'h-screen overflow-hidden' : 'min-h-screen grid place-items-center px-4 sm:px-6 lg:px-6 xl:px-8'}>
          {gameId && gameName && currentGame ? (
            isPortrait ? (
              /* Portrait: fixed height (100dvh) so footer (Sorteo, Validador de Parejas) is always visible without scroll */
              <div className="h-dvh w-screen overflow-hidden flex flex-col">
                <div
                  ref={portraitContentRef}
                  className={`px-4 sm:px-6 flex-1 min-h-0 flex flex-col overflow-hidden ${portraitPaddingDvh === 5 ? 'gap-2' : 'gap-4'}`}
                  style={{
                    paddingTop: `${portraitPaddingDvh}dvh`,
                    paddingBottom: `${portraitPaddingDvh}dvh`,
                  }}
                >
                  {/* Header: logo */}
                  {(customLogo || currentGame.assets?.logo) && (
                    <div className="flex-shrink-0 flex flex-col items-center -mt-1">
                      <img
                        src={customLogo ?? currentGame.assets!.logo}
                        alt={customLogo ? 'Logo del cliente' : currentGame.name}
                        className={GAME_SCREEN_LOGO_CLASS}
                      />
                      {customLogo && currentGame && (
                        <img
                          src={`/images/${currentGame.id}-letras.png`}
                          alt=""
                          className={GAME_SCREEN_LETRAS_CLASS}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                  )}
                  {/* Main: GameScreen fills remaining space, no internal scroll */}
                  <div className="card flex-1 min-h-0 w-full overflow-hidden flex flex-col p-5 sm:p-6 lg:p-8">
                    <currentGame.GameScreen
                      key={`game-${gameId}-${gameConfigVersion}`}
                      gameName={gameName}
                      gameId={gameId}
                      orientation="portrait"
                    />
                  </div>
                  {/* Footer: Sorteo + Validador de Parejas (Players) always visible */}
                  <div className="flex flex-row gap-3 flex-wrap items-stretch min-w-0 flex-shrink-0">
                    <div className="flex-1 min-w-[160px]">
                      <Players gameName={gameName} gameId={gameId ?? undefined} gameType={gameType ?? undefined} compact countersOnly={gameType?.toLowerCase() === 'empareja2'} />
                    </div>
                    {currentGame.showRanking && (
                      <div className="flex-1 min-w-[160px]">
                        <Ranking gameId={gameId} />
                      </div>
                    )}
                    <div className="flex-1 min-w-[160px]">
                      <RaffleData gameId={gameId} gameName={gameName} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Landscape: 10% air on sides (and top/bottom); scale content to fit the remaining 80% */
              <div className="h-dvh w-screen overflow-hidden flex justify-center items-center p-[10dvh_10dvw]">
                <div
                  className="flex-shrink-0 max-w-full max-h-full"
                  style={{
                    ...(landscapeContentSize
                      ? { width: landscapeContentSize.width, height: landscapeContentSize.height }
                      : { width: '100%', height: '100%' }),
                    transform: `scale(${landscapeScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <div
                    ref={landscapeContentRef}
                    className="h-full w-full overflow-hidden flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <currentGame.GameScreen
                        key={`game-${gameId}-${gameConfigVersion}`}
                        gameName={gameName}
                        gameId={gameId}
                        orientation="landscape"
                        logoElement={
                          (customLogo || currentGame.assets?.logo) ? (
                            <div className="flex flex-col items-center -mt-3">
                              <img
                                src={customLogo ?? currentGame.assets!.logo}
                                alt={customLogo ? 'Logo del cliente' : currentGame.name}
                                className={GAME_SCREEN_LOGO_CLASS}
                              />
                              {customLogo && currentGame && (
                                <img
                                  src={`/images/${currentGame.id}-letras.png`}
                                  alt=""
                                  className={GAME_SCREEN_LETRAS_CLASS_LANDSCAPE}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              )}
                            </div>
                          ) : null
                        }
                        sidebarElement={
                          <div className="flex flex-col gap-3">
                            <Players gameName={gameName} gameId={gameId ?? undefined} gameType={gameType ?? undefined} compact countersOnly={gameType?.toLowerCase() === 'empareja2'} />
                            {currentGame.showRanking && <Ranking gameId={gameId} compact />}
                            <RaffleData gameId={gameId} gameName={gameName} compact />
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* GameGate Catalog */
            <div className="card w-full max-w-md p-8">
              <GameGate onGameCreated={handleGameCreated} />
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
            onConfigSaved={() => setGameConfigVersion(v => v + 1)}
          />
        )}

        {/* Logo fijo - always stand logo in bottom right corner */}
        <div className={`fixed right-4 bottom-4 opacity-80 hover:opacity-100 transition-opacity z-10 ${isPortrait ? 'w-14 h-14 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20' : 'w-10 h-10 lg:w-12 lg:h-12'}`}>
          <img 
            src="/images/stand-logo.png" 
            alt="Stand" 
            className="w-full h-full object-contain" 
          />
        </div>
      </div>
    </ThemeProvider>
  )
}

