import { useState, useEffect, useRef } from 'react'
import { games } from '../../games'
import type { GameDefinition, GameIdealFor, GamePlayerMode } from '../types'
import { IDEAL_FOR_LABELS } from '../types'
import { api } from '../../api/api'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useStandLogo } from '../theme'
import { fetchUserMedia, resolveUserSelectedLogoUrl, type UserMediaResponse } from '../../api/userMedia'

const GAME_RE = /^[A-Za-z0-9._-]{1,40}$/

type GameGateProps = {
  onGameCreated: (gameName: string, gameId: string, gameType?: string) => void
}

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
  const [userMedia, setUserMedia] = useState<UserMediaResponse | null>(null)
  const [userMediaLoaded, setUserMediaLoaded] = useState(false)
  const customLogo = userMedia ? resolveUserSelectedLogoUrl(userMedia) : null
  const headerLogoSrc = userMediaLoaded ? (customLogo ?? standLogo) : null
  const [userGames, setUserGames] = useState<UserGame[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [idealForFilter, setIdealForFilter] = useState<GameIdealFor | null>(null)
  const [playerModeFilter, setPlayerModeFilter] = useState<GamePlayerMode | null>(null)
  const [socialFilter, setSocialFilter] = useState<boolean | null>(null)
  const [competitiveFilter, setCompetitiveFilter] = useState<boolean | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Count existing games from localStorage (simple approach for MVP)
  const existingGameId = localStorage.getItem('gameId')
  const hasExistingGame = !!existingGameId
  const canCreateGame = features.maxGames === Infinity || !hasExistingGame || (hasExistingGame && features.maxGames > 1)

  // Load custom logo from backend media selection
  useEffect(() => {
    const load = async () => {
      try {
        const media = await fetchUserMedia()
        setUserMedia(media)
      } catch {
        setUserMedia(null)
      } finally {
        setUserMediaLoaded(true)
      }
    }
    void load()
    const onMediaUpdate = () => void load()
    window.addEventListener('user-media-updated', onMediaUpdate)
    return () => window.removeEventListener('user-media-updated', onMediaUpdate)
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

  useEffect(() => {
    if (selectedGame) return
    const id = window.requestAnimationFrame(() => {
      const root = document.querySelector('[data-focus-root]')
      const el = root?.querySelector<HTMLElement>('button')
      el?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [selectedGame])

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
        gameType: selectedGame.id
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
    const filteredGames = games.filter((g) => {
      if (idealForFilter != null && !g.tags?.idealFor?.includes(idealForFilter)) return false
      if (playerModeFilter != null && g.tags?.playerMode !== playerModeFilter) return false
      if (socialFilter !== null && g.tags?.social !== socialFilter) return false
      if (competitiveFilter !== null && g.tags?.competitive !== competitiveFilter) return false
      return true
    })
    const hasNoGames = filteredGames.length === 0

    return (
      <div className="w-full space-y-6">
        {/* Header with Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-28 flex items-center justify-center">
            {headerLogoSrc ? (
              <img
                src={headerLogoSrc}
                alt={customLogo ? 'Logo personalizado' : 'Stand'}
                className="h-28 w-auto object-contain"
                onError={(e) => {
                  if (customLogo) return
                  const target = e.target as HTMLImageElement
                  if (target.src !== `${window.location.origin}/images/logo_stand_letters_white.png`) {
                    target.src = '/images/logo_stand_letters_white.png'
                  }
                }}
              />
            ) : null}
          </div>
        </div>

        {/* Games Grid */}
        <div className="space-y-4">
          {/* Filter dropdowns: each defaults to "Todos", filters accumulate (AND) */}
          <div className="flex flex-wrap gap-3 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-textSub">Ideal para</span>
              <select
                value={idealForFilter ?? ''}
                onChange={(e) => setIdealForFilter((e.target.value || null) as GameIdealFor | null)}
                className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 py-2 text-sm text-textMain focus:border-white/20 outline-none min-w-[140px]"
              >
                <option value="">Todos</option>
                {(Object.keys(IDEAL_FOR_LABELS) as GameIdealFor[]).map((key) => (
                  <option key={key} value={key}>{IDEAL_FOR_LABELS[key]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-textSub">Jugadores</span>
              <select
                value={playerModeFilter ?? ''}
                onChange={(e) => setPlayerModeFilter((e.target.value || null) as GamePlayerMode | null)}
                className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 py-2 text-sm text-textMain focus:border-white/20 outline-none min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="solo">Individual</option>
                <option value="multi">Multijugador</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-textSub">Social</span>
              <select
                value={socialFilter === null ? '' : String(socialFilter)}
                onChange={(e) => setSocialFilter(e.target.value === '' ? null : e.target.value === 'true')}
                className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 py-2 text-sm text-textMain focus:border-white/20 outline-none min-w-[120px]"
              >
                <option value="">Todos</option>
                <option value="true">Social</option>
                <option value="false">No social</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-textSub">Tipo</span>
              <select
                value={competitiveFilter === null ? '' : String(competitiveFilter)}
                onChange={(e) => setCompetitiveFilter(e.target.value === '' ? null : e.target.value === 'true')}
                className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 py-2 text-sm text-textMain focus:border-white/20 outline-none min-w-[120px]"
              >
                <option value="">Todos</option>
                <option value="true">Competitivo</option>
                <option value="false">Casual</option>
              </select>
            </label>
          </div>
          {/* List with fixed min-height so layout does not jump when filtering */}
          <div className="min-h-[360px] md:min-h-[420px] overflow-y-auto rounded-xl pt-5 sm:pt-6 pb-3">
            {hasNoGames ? (
              <p className="text-center text-textSub text-sm py-6">
                Ningún juego con los filtros seleccionados.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 justify-items-center">
                {filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleGameSelect(game)}
                    type="button"
                    aria-label={game.name}
                    className="w-full max-w-[120px] sm:max-w-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-3xl transition-transform duration-150 ease-out hover:scale-[1.04]"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[rgba(255,255,255,0.08)] border border-white/10 shadow-[0_10px_25px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden mb-2">
                        {game.assets?.logo ? (
                          <img
                            src={game.assets.logo}
                            alt={game.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                          />
                        ) : (
                          <span className="text-lg sm:text-xl font-semibold text-textMain">
                            {game.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-medium text-textMain text-center leading-snug line-clamp-2">
                        {game.name}
                      </h3>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const selectedGameDescription = selectedGame.descriptionLong ?? selectedGame.description ?? ''
  const selectedGameHasTags =
    !!selectedGame.tags &&
    (selectedGame.tags.playerMode != null ||
      selectedGame.tags.social !== undefined ||
      selectedGame.tags.competitive !== undefined ||
      (selectedGame.tags.idealFor?.length ?? 0) > 0)

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

      {/* Selected Game Info: [logo] | [description + tags] */}
      <div className="p-5 sm:p-6 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
          <div className="flex items-center justify-center min-h-[160px] md:min-h-[220px] px-2">
            {selectedGame.assets?.logo ? (
              <img
                src={selectedGame.assets.logo}
                alt={selectedGame.name}
                className="max-h-44 sm:max-h-52 md:max-h-60 w-auto max-w-full object-contain"
              />
            ) : (
              <div
                className="flex h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 rounded-2xl bg-[rgba(255,255,255,0.08)] border border-white/10 items-center justify-center"
                aria-hidden
              >
                <span className="text-2xl sm:text-3xl font-semibold text-textMain">
                  {selectedGame.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 min-w-0 min-h-full">
            <div className="flex-1 min-h-0">
              <p className="text-sm sm:text-base text-textSub leading-relaxed text-center md:text-left">
                {selectedGameDescription}
              </p>
            </div>
            {selectedGameHasTags && selectedGame.tags && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 pt-3 border-t border-white/10 md:mt-auto">
                {selectedGame.tags.playerMode && (
                  <span className="flex items-center gap-1.5 text-xs text-textSub" title={selectedGame.tags.playerMode === 'multi' ? 'Multijugador' : 'Individual'}>
                    {selectedGame.tags.playerMode === 'multi' ? (
                      <svg className="w-4 h-4 text-textMain flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-textMain flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    )}
                    {selectedGame.tags.playerMode === 'multi' ? 'Multijugador' : 'Individual'}
                  </span>
                )}
                {selectedGame.tags.social !== undefined && (
                  <span className="flex items-center gap-1.5 text-xs text-textSub" title={selectedGame.tags.social ? 'Implica socializar' : 'No implica socializar'}>
                    <svg className="w-4 h-4 text-textMain flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {selectedGame.tags.social ? 'Social' : 'No social'}
                  </span>
                )}
                {selectedGame.tags.competitive !== undefined && (
                  <span className="flex items-center gap-1.5 text-xs text-textSub" title={selectedGame.tags.competitive ? 'Competitivo' : 'Casual'}>
                    <svg className="w-4 h-4 text-textMain flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    {selectedGame.tags.competitive ? 'Competitivo' : 'Casual'}
                  </span>
                )}
                {selectedGame.tags.idealFor && selectedGame.tags.idealFor.length > 0 && (
                  <span className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 text-xs text-textSub">
                    {selectedGame.tags.idealFor.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded bg-white/10 text-textSub"
                        title="Ideal para"
                      >
                        {IDEAL_FOR_LABELS[key]}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
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
      <div className="space-y-2">
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={loading || !gameId.trim() || !canCreateGame || selectedGame.underDevelopment}
            className="flex-1 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium relative"
            title={selectedGame.underDevelopment ? 'Juego en desarrollo' : !canCreateGame ? 'Disponible en el plan Event' : undefined}
          >
            {loading ? 'Creando...' : 'Crear'}
          </button>
          <button
            onClick={handleJoin}
            disabled={joining || !gameId.trim()}
            className="flex-1 p-4 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {joining ? 'Buscando...' : 'Unirse'}
          </button>
        </div>
        {selectedGame.underDevelopment && (
          <p className="text-xs text-amber-400 text-center">En desarrollo (solo unirse)</p>
        )}
        {!canCreateGame && !selectedGame.underDevelopment && (
          <p className="text-xs text-yellow-400 text-center">Disponible en el plan Event</p>
        )}
      </div>
    </div>
  )
}
