import { useState, useEffect, useRef } from 'react'
import { games } from '../games'
import type { GameDefinition } from './types'
import { api } from '../api/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import { getFeaturesByPlan } from '../auth/featureFlags'
import { useStandLogo } from './logoUtils'

const GAME_RE = /^[A-Za-z0-9._-]{1,40}$/

type GameGateProps = {
  onGameCreated: (gameName: string, gameId: string, gameType?: string) => void
}

const STORAGE_KEY_LOGO = 'app_custom_logo'

interface UserGame {
  gameId: string
  gameName: string
  gameType: string
  createdAt: string
  maxPlayers: number
}

export default function GameGate({ onGameCreated }: GameGateProps){
  const { plan, user } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const standLogo = useStandLogo()
  const [selectedGame, setSelectedGame] = useState<GameDefinition | null>(null)
  const [gameId, setGameId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const [userGames, setUserGames] = useState<UserGame[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Count existing games from localStorage (simple approach for MVP)
  const existingGameId = localStorage.getItem('gameId')
  const hasExistingGame = !!existingGameId
  const canCreateGame = features.maxGames === Infinity || !hasExistingGame || (hasExistingGame && features.maxGames > 1)

  // Load custom logo from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO)
    if (saved) {
      setCustomLogo(saved)
    }
  }, [])

  // Fetch user games when a game is selected (API expects gameType = game id, e.g. SEMAFORO)
  useEffect(() => {
    if (selectedGame && user) {
      fetchUserGames(selectedGame.id)
    } else {
      setUserGames([])
    }
  }, [selectedGame, user])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchUserGames = async (gameType: string) => {
    if (!user) return
    
    setLoadingGames(true)
    try {
      // Fetch user games from API: GET /v1/game?gameType=TYPE
      // Response format: { ok: true, games: [...], count: number, gameType: string, ownerUserId: string }
      const response = await api.get<{
        ok: boolean
        games: UserGame[]
        count: number
        gameType: string
        ownerUserId: string
      }>(`/v1/game?gameType=${encodeURIComponent(gameType.toUpperCase())}`)
      
      // Handle response format
      if (response && response.ok && Array.isArray(response.games)) {
        setUserGames(response.games)
      } else {
        setUserGames([])
      }
    } catch (e: any) {
      // If endpoint fails, just show empty list
      console.warn('Could not fetch user games:', e.message)
      setUserGames([])
    } finally {
      setLoadingGames(false)
    }
  }

  const validateGameId = (id: string) => GAME_RE.test(id)

  const handleGameSelect = (game: GameDefinition) => {
    setSelectedGame(game)
    setGameId('')
    setError(null)
    setShowDropdown(false)
  }

  const handleGameSelectFromDropdown = (game: UserGame) => {
    setGameId(game.gameName)
    setShowDropdown(false)
    setError(null)
  }

  const handleBackToCatalog = () => {
    setSelectedGame(null)
    setGameId('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!selectedGame) return
    
    setError(null)
    
    // Check maxGames limit
    if (!canCreateGame) {
      setError('Disponible en el plan Event')
      return
    }
    
    if (!validateGameId(gameId)) {
      setError('Nombre de partida inválido. Usa letras, números, _ - .')
      return
    }

    setLoading(true)
    try {
      const response = await api.post<{ 
        message: string
        game: {
          gameId: string
          ownerUserId: string
          gameType: string
          gameName: string
          isActive: boolean
          maxPlayers: number
          createdAt: string
          updatedAt: string
        }
      }>('/v1/game', { 
        gameName: gameId.toUpperCase(),
        gameType: selectedGame.id.toUpperCase()
      })
      
      // API returns { message, game: { gameId, gameName, gameType, ... } }
      if (response.game && response.game.gameId && response.game.gameName) {
        onGameCreated(response.game.gameName, response.game.gameId, response.game.gameType || selectedGame.id)
      } else {
        throw new Error('Respuesta inválida del servidor')
      }
    } catch (e: any) {
      setError(e.message || 'No se ha podido crear la partida. Prueba con otro nombre.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!selectedGame) return

    setError(null)
    if (!validateGameId(gameId)) {
      setError('Nombre de partida inválido. Usa letras, números, _ - .')
      return
    }

    const name = gameId.trim()
    if (name.toUpperCase().includes('_TEST')) {
      onGameCreated(name.toUpperCase(), name.toLowerCase().replace(/\s+/g, '_'), selectedGame.id)
      return
    }

    setJoining(true)
    try {
      const response = await api.get<{
        message: string
        game: {
          gameId: string
          gameName: string
          gameType: string
          createdAt: string
          maxPlayers: number
        }
      }>(`/v1/game?gameName=${encodeURIComponent(gameId.toUpperCase())}`)

      if (response.game && response.game.gameId && response.game.gameName) {
        onGameCreated(response.game.gameName, response.game.gameId, response.game.gameType || selectedGame.id)
      } else {
        throw new Error('Respuesta inválida del servidor')
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo unirse a la partida. Verifica el nombre e intenta nuevamente.')
    } finally {
      setJoining(false)
    }
  }

  // Game Catalog View
  if (!selectedGame) {
    return (
      <div className="w-full space-y-6">
        {/* Header with Logo */}
        <div className="flex flex-col items-center mb-6">
          {/* Custom logo or Stand Letters Logo */}
          {customLogo ? (
            <img 
              src={customLogo} 
              alt="Logo personalizado" 
              className="h-20 w-auto object-contain"
            />
          ) : (
            <img 
              src={standLogo} 
              alt="Stand" 
              className="h-20 w-auto object-contain"
              onError={(e) => {
                // Fallback to stand-logo.png if logo doesn't exist
                const target = e.target as HTMLImageElement
                if (target.src !== `${window.location.origin}/images/stand-logo.png`) {
                  target.src = '/images/stand-logo.png'
                }
              }}
            />
          )}
        </div>

        {/* Games Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-textMain text-center mb-4">Selecciona un juego</h2>
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameSelect(game)}
              className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:border-white/20 text-left"
            >
              <div className="flex items-center gap-4">
                {game.assets?.logo && (
                  <div className="flex-shrink-0">
                    <img 
                      src={game.assets.logo} 
                      alt={game.name} 
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-textMain mb-1">{game.name}</h3>
                  {game.description && (
                    <p className="text-sm text-textSub line-clamp-2">{game.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Create/Join Game View - Direct action buttons
  return (
    <div className="w-full space-y-4">
      {/* Back Button */}
      <button
        onClick={handleBackToCatalog}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-textMain transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al catálogo
      </button>

      {/* Selected Game Info */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
        {selectedGame.assets?.logo && (
          <img 
            src={selectedGame.assets.logo} 
            alt={selectedGame.name} 
            className="h-12 w-12 object-contain"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold text-textMain">{selectedGame.name}</h3>
          {selectedGame.description && (
            <p className="text-sm text-textSub">{selectedGame.description}</p>
          )}
        </div>
      </div>

      {/* Game ID Input with Dropdown */}
      <div className="space-y-2 relative">
        <label htmlFor="game-id" className="text-sm text-gray-300">Nombre de la partida</label>
        <div className="relative">
          <input
            ref={inputRef}
            id="game-id"
            name="game-name-input"
            value={gameId}
            onChange={(e) => {
              setGameId(e.target.value.toUpperCase())
              setShowDropdown(true)
            }}
            onFocus={() => {
              if (userGames.length > 0) {
                setShowDropdown(true)
              }
            }}
            placeholder="ej. TORNEO_1"
            autoComplete="off"
            data-form-type="other"
            className="w-full h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 pr-10 outline-none focus:border-white/20 uppercase"
          />
          {userGames.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-textMain transition-colors"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          {/* Dropdown with user games */}
          {showDropdown && userGames.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-xl bg-[rgba(20,20,30,0.95)] border border-white/20 shadow-xl backdrop-blur-sm"
            >
              {loadingGames ? (
                <div className="p-3 text-center text-sm text-gray-400">Cargando partidas...</div>
              ) : (
                <div className="py-1">
                  {userGames.map((game) => (
                    <button
                      key={game.gameId}
                      type="button"
                      onClick={() => handleGameSelectFromDropdown(game)}
                      className="w-full px-4 py-2 text-left text-sm text-textMain hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                    >
                      <span className="font-medium">{game.gameName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {userGames.length > 0 
            ? `Tienes ${userGames.length} partida${userGames.length > 1 ? 's' : ''} creada${userGames.length > 1 ? 's' : ''}. Selecciona una o escribe un nombre nuevo.`
            : 'Caracteres permitidos: letras, números, _ - .'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      {/* Player limit info for FREE plan */}
      {features.maxPlayers !== Infinity && (
        <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
          <p className="text-yellow-300 text-sm">
            Plan Gratis: Máximo {features.maxPlayers} jugadores por partida
          </p>
        </div>
      )}

      {/* Action Buttons - Direct actions */}
      <div className="flex gap-3">
        <button
          onClick={handleCreate}
          disabled={loading || !gameId.trim() || !canCreateGame}
          className="flex-1 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium relative"
          title={!canCreateGame ? 'Disponible en el plan Event' : undefined}
        >
          {loading ? 'Creando...' : 'Crear'}
        </button>
        {!canCreateGame && (
          <p className="text-xs text-yellow-400 text-center mt-1">
            Disponible en el plan Event
          </p>
        )}
        <button
          onClick={handleJoin}
          disabled={joining || !gameId.trim()}
          className="flex-1 p-4 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {joining ? 'Buscando...' : 'Unirse'}
        </button>
      </div>
    </div>
  )
}
