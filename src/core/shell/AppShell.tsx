import { useEffect, useState, useRef } from 'react'
import { ThemeProvider, useAvatarsEnabled, getAvatarsEnabled } from '../theme'
import GameGate from './GameGate'
import SettingsMenu from './SettingsMenu'
import Ranking from '../widgets/Ranking'
import Players from '../widgets/Players'
import RaffleData from '../widgets/RaffleData'
import GameStateAvatar from '../widgets/GameStateAvatar'
import { getGameById } from '../../games'
import type { GameDefinition } from '../types'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useOrientation } from '../../hooks/useOrientation'
import { readMaxPrizeValidation, readMaxPrizeRanking, readMaxPrizeRaffle } from '../settings/operatorPrizeSlots'
import { inputManager } from '../input/inputManager'
import { normalizeGameType } from '../gameTypeMap'
import { api } from '../../api/api'
import GamePortraitHeaderJoin from '../widgets/GamePortraitHeaderJoin'
import { getJoinInstructions } from '../ui/gameJoinInstructions'
import { fetchUserMedia, resolveUserSelectedLogoUrl, type UserMediaResponse } from '../../api/userMedia'
import { resolveGameAccess, type GameAccess } from '../settings/gameAccess'
import MobileGameHome from '../widgets/MobileGameHome'
import { OperatorLanguageProvider, useOperatorLanguage } from './operatorLanguage'
import { usePolling } from '../../hooks/usePolling'
import type { PrizeCatalog } from '../prizes'
// Logo size on game screens (portrait and landscape) — larger across breakpoints
// Landscape: slightly smaller so left column fits
const GAME_SCREEN_LOGO_CLASS_LANDSCAPE = 'h-28 sm:h-32 lg:h-36 xl:h-40 2xl:h-44 w-auto object-contain max-w-full'

export default function AppShell() {
  return (
    <OperatorLanguageProvider>
      <AppContent />
    </OperatorLanguageProvider>
  )
}

function AppContent() {
  const { language, t } = useOperatorLanguage()
  const { loading: userLoading, plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [showSettings, setShowSettings] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameName, setGameName] = useState<string | null>(null)
  const [gameType, setGameType] = useState<string | null>(null)
  const [gameDefinition, setGameDefinition] = useState<GameDefinition | null>(null)
  const avatarsEnabled = useAvatarsEnabled()
  const [userMedia, setUserMedia] = useState<UserMediaResponse | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const customLogo = userMedia ? resolveUserSelectedLogoUrl(userMedia) : null
  const [avatarMediaUrls, setAvatarMediaUrls] = useState<Partial<Record<'idle' | 'win' | 'lose', string | null>>>({})
  const [gameConfigVersion, setGameConfigVersion] = useState(0)
  const [loadedAccess, setLoadedAccess] = useState<{ gameId: string; access: GameAccess } | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [loadedPrizes, setLoadedPrizes] = useState<{ gameId: string; catalog?: PrizeCatalog } | null>(null)
  const prizeCatalog = loadedPrizes?.gameId === gameId ? loadedPrizes.catalog : undefined
  const metadataKey = JSON.stringify([gameId, gameType, gameConfigVersion])
  const metadataSource = useRef({ key: metadataKey })
  if (metadataSource.current.key !== metadataKey) metadataSource.current = { key: metadataKey }
  const access = loadedAccess?.gameId === gameId ? loadedAccess.access : null
  const joinChannel = access?.joinChannel
  const playMode = access?.playMode
  const [gameSettings, setGameSettings] = useState<Record<string, unknown> | null>(null)
  const [counterActive, setCounterActive] = useState(false)
  const [avatarState, setAvatarState] = useState('idle')
  const portraitContentRef = useRef<HTMLDivElement>(null)
  const landscapeContentRef = useRef<HTMLDivElement>(null)
  const [portraitPaddingTopDvh, setPortraitPaddingTopDvh] = useState(5)
  const [portraitPaddingBottomDvh, setPortraitPaddingBottomDvh] = useState(10)
  const [landscapeScale, setLandscapeScale] = useState(1)
  const [landscapeContentSize, setLandscapeContentSize] = useState<{ width: number; height: number } | null>(null)

  // Load custom logo and avatar media from backend.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const media = await fetchUserMedia()
        if (cancelled) return
        if (!media.ok) throw new Error('Unable to load appearance media')
        setUserMedia(media)
        if (getAvatarsEnabled()) {
          setAvatarMediaUrls({
            idle: media.avatar.selected?.idle?.url ?? null,
            win: media.avatar.selected?.win?.url ?? null,
            lose: media.avatar.selected?.lose?.url ?? null,
          })
        } else {
          setAvatarMediaUrls({})
        }
      } catch (error) {
        if (cancelled) return
        console.error('Unable to load appearance media:', error)
        setUserMedia(null)
      } finally {
        if (!cancelled) setMediaLoading(false)
      }
    }
    void load()

    const onMediaUpdate = () => void load()
    window.addEventListener('user-media-updated', onMediaUpdate)
    return () => {
      cancelled = true
      window.removeEventListener('user-media-updated', onMediaUpdate)
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
      const gameIdToUse = normalizeGameType(savedGameType || savedGameId.split('_')[0])
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

  // Load game settings from localStorage (for prize labels in minicontainers)
  useEffect(() => {
    if (gameId && gameDefinition?.id) {
      const storageKey = `${gameDefinition.id}_settings_${gameId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          setGameSettings(JSON.parse(saved))
        } catch {
          setGameSettings(null)
        }
      } else {
        setGameSettings(null)
      }
    } else {
      setGameSettings(null)
    }
  }, [gameId, gameDefinition?.id, gameConfigVersion])

  useEffect(() => {
    setAccessError(null)
    setLoadedAccess(null)
    setLoadedPrizes(null)
  }, [gameId, gameType, gameConfigVersion])

  // Server metadata, not cached signed URLs, is authoritative. Refresh without remounting gameplay.
  usePolling(async () => {
    if (!gameId) return
    const source = metadataSource.current
    try {
      const data = await api.get<{ ok: boolean; prizeCatalog?: PrizeCatalog; game?: { joinChannel?: string; playMode?: string; gameType?: string } }>(
        `/v1/game?gameId=${encodeURIComponent(gameId)}`
      )
      if (metadataSource.current !== source) return
      if (!data.ok || !data.game) throw new Error('No se pudo cargar el acceso del juego.')
      const nextAccess = resolveGameAccess(data.game.gameType || gameType || '', data.game)
      setLoadedAccess(previous => previous?.gameId === gameId
        && previous.access.joinChannel === nextAccess.joinChannel
        && previous.access.playMode === nextAccess.playMode
        ? previous : { gameId, access: nextAccess })
      setLoadedPrizes({ gameId, catalog: data.prizeCatalog })
      setAccessError(null)
    } catch (cause) {
      if (metadataSource.current === source) {
        setAccessError(cause instanceof Error ? cause.message : 'No se pudo cargar el acceso del juego.')
      }
      throw cause
    }
  }, [gameId, gameType, gameConfigVersion], { interval: gameId ? 60_000 : 0 })

  useEffect(() => {
    setAvatarState('idle')
  }, [gameId, gameConfigVersion])

  const handleGameCreated = (name: string, id: string, type?: string) => {
    setGameName(name)
    setGameId(id)
    const gameIdToUse = normalizeGameType(type)
    setGameType(gameIdToUse)
  }

  const handleLeaveGame = () => {
    setGameId(null)
    setGameName(null)
    setGameType(null)
    setGameDefinition(null)
    setShowSettings(false)
    setAvatarState('idle')
  }

  const backShellRef = useRef({ showSettings: false, inGame: false })
  const leaveGameRef = useRef(handleLeaveGame)
  leaveGameRef.current = handleLeaveGame
  useEffect(() => {
    backShellRef.current = {
      showSettings,
      inGame: !!(gameId && gameName && gameDefinition),
    }
  }, [showSettings, gameId, gameName, gameDefinition])

  useEffect(() => {
    return inputManager.registerBackInterceptor(() => {
      if (backShellRef.current.showSettings) {
        return false
      }
      if (backShellRef.current.inGame) {
        leaveGameRef.current()
        return true
      }
      return false
    })
  }, [])

  const handleExitApp = () => {
    // Clear all localStorage
    localStorage.clear()
    // Optionally reload the page or close the app
    window.location.reload()
  }

  // Use game definition if available, otherwise use a default theme (no specific game)
  const currentGame = gameDefinition
  const isPortrait = useOrientation()

  // Derive prize labels for minicontainers from game settings
  const gs = gameSettings as Record<string, unknown> | null
  const playersPrizeLabel =
    prizeCatalog !== undefined ? prizeCatalog.validation?.name :
    gs && typeof gs.prizeValidation === 'string' && gs.prizeValidation.trim()
      ? gs.prizeValidation.trim()
      : undefined
  const rankingPrizeLabel =
    prizeCatalog !== undefined ? prizeCatalog.ranking?.name :
    currentGame?.showRanking && gs && typeof gs.prizeTopX === 'string' && gs.prizeTopX.trim()
      ? gs.prizeTopX.trim()
      : undefined
  const rankingTopX =
    prizeCatalog !== undefined ? prizeCatalog.ranking?.topX :
    currentGame?.showRanking && gs && typeof gs.topX === 'number' && gs.topX >= 1
      ? gs.topX
      : undefined
  const maxPrizeValidationFromSettings = prizeCatalog !== undefined ? prizeCatalog.validation?.limit ?? undefined : readMaxPrizeValidation(gs)
  const maxPrizeRankingFromSettings = prizeCatalog !== undefined ? prizeCatalog.ranking?.limit ?? undefined : readMaxPrizeRanking(gs)
  const maxPrizeRaffleFromSettings = prizeCatalog !== undefined ? prizeCatalog.raffle?.limit ?? undefined : readMaxPrizeRaffle(gs)
  const rafflePrizeLabel =
    prizeCatalog !== undefined ? prizeCatalog.raffle?.name :
    gs && typeof gs.prizeRaffle === 'string' && gs.prizeRaffle.trim() ? gs.prizeRaffle.trim() : undefined

  // Portrait: 5% air at top (logo), 10% at bottom; reduce bottom when content overflows so nothing is hidden
  useEffect(() => {
    if (!isPortrait) {
      setPortraitPaddingTopDvh(5)
      setPortraitPaddingBottomDvh(10)
      return
    }
    const el = portraitContentRef.current
    if (!el) return
    const HYSTERESIS_PX = 40
    const checkOverflow = () => {
      const sh = el.scrollHeight
      const vh = window.innerHeight
      setPortraitPaddingBottomDvh((prev) => {
        if (sh > vh) return 5
        if (sh <= vh - HYSTERESIS_PX) return 10
        return prev
      })
    }
    setPortraitPaddingTopDvh(5)
    checkOverflow()
    const ro = new ResizeObserver(checkOverflow)
    ro.observe(el)
    window.addEventListener('resize', checkOverflow)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', checkOverflow)
    }
  }, [isPortrait, gameId, gameConfigVersion, access, userLoading])

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
      const availableW = vw * 0.9
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
  }, [isPortrait, gameId, gameConfigVersion, access, userLoading])
  if (userLoading) {
    return (
      <ThemeProvider game={currentGame}>
        <div lang={language} className="bg-club text-textMain font-sans min-h-screen flex items-center justify-center px-6">
          <div className="card w-full max-w-md p-8 text-center">
            <p className="text-textMain">{t('Cargando...', 'Loading...')}</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider game={currentGame}>
      <div lang={language} className="bg-club text-textMain font-sans">
        {/* Settings Icon */}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className={`fixed top-4 left-4 z-40 p-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-black/30 transition-all duration-200 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 ${isPortrait ? 'min-w-[44px] min-h-[44px]' : 'min-w-[36px] min-h-[36px]'}`}
          aria-label={t('Configuración', 'Settings')}
        >
          <svg className={`${isPortrait ? 'w-6 h-6 lg:w-7 lg:h-7' : 'w-5 h-5'} text-white/70`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className={gameId && gameName && currentGame ? 'h-screen overflow-hidden' : 'min-h-screen grid place-items-center px-4 sm:px-6 lg:px-6 xl:px-8'}>
          {gameId && gameName && currentGame ? (
            !access || mediaLoading ? (
              <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6">
                <p role={accessError ? 'alert' : 'status'}>{accessError
                  ? accessError === 'No se pudo cargar el acceso del juego.'
                    ? t(accessError, 'Unable to load game access.')
                    : accessError
                  : mediaLoading
                    ? t('Cargando aspecto del juego...', 'Loading game appearance...')
                    : t('Cargando acceso del juego...', 'Loading game access...')}</p>
                {accessError && <button type="button" onClick={() => setGameConfigVersion((v) => v + 1)}>{t('Reintentar carga', 'Retry loading')}</button>}
              </div>
            ) : playMode === 'mobile' ? (
              <div className={isPortrait
                ? 'h-dvh w-screen overflow-y-auto px-6 sm:px-8 pt-[8dvh] pb-[10dvh]'
                : 'h-dvh w-screen overflow-hidden pt-[7dvh] pb-[max(7dvh,4rem)] px-[4dvw]'}>
                <MobileGameHome
                  gameId={gameId}
                  gameName={gameName}
                  joinChannel={access.joinChannel}
                  portrait={isPortrait}
                  logoSrc={customLogo ?? currentGame.assets?.logo}
                  logoAlt={customLogo ? t('Logo del cliente', 'Client logo') : currentGame.name}
                  players={
                    <Players gameName={gameName} gameId={gameId} gameType={gameType ?? undefined} compact countersOnly={normalizeGameType(gameType ?? undefined) === 'EMPAREJA2'} prize={prizeCatalog?.validation} prizeLabel={playersPrizeLabel} maxPrizeValidationLimit={maxPrizeValidationFromSettings} refreshInterval={10000} />
                  }
                  raffle={features.raffles ? (
                    <RaffleData gameId={gameId} gameName={gameName} compact={!isPortrait} prize={prizeCatalog?.raffle} prizeLabel={rafflePrizeLabel} maxPrizeRaffle={maxPrizeRaffleFromSettings} refreshInterval={10000} />
                  ) : undefined}
                  ranking={currentGame.showRanking ? (
                    <Ranking gameId={gameId} gameType={gameType ?? undefined} prize={prizeCatalog?.ranking} prizeLabel={rankingPrizeLabel} topX={rankingTopX} maxPrizeRanking={maxPrizeRankingFromSettings} refreshInterval={10000} />
                  ) : undefined}
                />
              </div>
            ) : isPortrait ? (
              /* Portrait: fixed height (100dvh) so footer (Sorteo, Validador de Parejas) is always visible without scroll */
              <div className="h-dvh w-screen overflow-hidden flex flex-col">
                <div
                  ref={portraitContentRef}
                  className={`px-4 sm:px-6 flex-1 min-h-0 flex flex-col overflow-hidden ${portraitPaddingBottomDvh === 5 ? 'gap-2' : 'gap-4'}`}
                  style={{
                    paddingTop: `${portraitPaddingTopDvh}dvh`,
                    paddingBottom: `${portraitPaddingBottomDvh}dvh`,
                  }}
                >
                  <GamePortraitHeaderJoin
                    gameId={gameId}
                    joinChannel={joinChannel}
                    logoElement={
                      customLogo || currentGame.assets?.logo ? (
                        <img
                          src={customLogo ?? currentGame.assets!.logo}
                          alt={customLogo ? t('Logo del cliente', 'Client logo') : currentGame.name}
                          className="max-h-20 sm:max-h-24 w-auto object-contain"
                        />
                      ) : null
                    }
                    footerChildren={getJoinInstructions(currentGame.id, access, t)}
                  />
                  {/* Main: con ranking, repartimos altura (juego : panel inferior) para que el ranking use el hueco */}
                  {currentGame.showRanking ? (
                    <div className="flex-1 min-h-0 flex flex-col gap-2 min-w-0 overflow-hidden">
                      <div className="card grow-[3] basis-0 shrink min-h-0 w-full overflow-hidden flex flex-col p-4 sm:p-5">
                        <currentGame.GameScreen
                          key={`game-${gameId}-${gameConfigVersion}`}
                          gameId={gameId}
                          orientation="portrait"
                          topX={rankingTopX}
                          prizeLabel={rankingPrizeLabel}
                          prizeCatalog={prizeCatalog}
                          onCounterActiveChange={setCounterActive}
                          onAvatarStateChange={setAvatarState}
                          avatarMediaUrls={avatarMediaUrls}
                          joinChannel={joinChannel}
                          playMode={playMode}
                        />
                      </div>
                      <div className="grow-[2] basis-0 shrink min-h-0 flex flex-col gap-3 min-w-0 overflow-hidden">
                        <div className="flex-shrink-0 w-full">
                          <Players gameName={gameName} gameId={gameId ?? undefined} gameType={gameType ?? undefined} compact countersOnly={normalizeGameType(gameType ?? undefined) === 'EMPAREJA2'} prize={prizeCatalog?.validation} prizeLabel={playersPrizeLabel} maxPrizeValidationLimit={maxPrizeValidationFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                        </div>
                        <div className="min-h-0 flex-1 flex flex-col min-w-0">
                          <Ranking gameId={gameId} gameType={gameType ?? undefined} prize={prizeCatalog?.ranking} prizeLabel={rankingPrizeLabel} topX={rankingTopX} maxPrizeRanking={maxPrizeRankingFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                        </div>
                        {features.raffles && (
                          <div className="flex-shrink-0 w-full">
                            <RaffleData gameId={gameId} gameName={gameName} prize={prizeCatalog?.raffle} prizeLabel={rafflePrizeLabel} maxPrizeRaffle={maxPrizeRaffleFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card flex-1 min-h-0 w-full overflow-hidden flex flex-col p-4 sm:p-5">
                        <currentGame.GameScreen
                          key={`game-${gameId}-${gameConfigVersion}`}
                          gameId={gameId}
                          orientation="portrait"
                          topX={rankingTopX}
                          prizeLabel={rankingPrizeLabel}
                          prizeCatalog={prizeCatalog}
                          onCounterActiveChange={setCounterActive}
                          onAvatarStateChange={setAvatarState}
                          avatarMediaUrls={avatarMediaUrls}
                          joinChannel={joinChannel}
                          playMode={playMode}
                        />
                      </div>
                      <div className="flex flex-row gap-3 flex-wrap items-stretch min-w-0 flex-shrink-0">
                        <div className="flex-1 min-w-[200px]">
                          <Players gameName={gameName} gameId={gameId ?? undefined} gameType={gameType ?? undefined} compact countersOnly={normalizeGameType(gameType ?? undefined) === 'EMPAREJA2'} prize={prizeCatalog?.validation} prizeLabel={playersPrizeLabel} maxPrizeValidationLimit={maxPrizeValidationFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                        </div>
                        {features.raffles && (
                          <div className="flex-1 min-w-[200px]">
                            <RaffleData gameId={gameId} gameName={gameName} prize={prizeCatalog?.raffle} prizeLabel={rafflePrizeLabel} maxPrizeRaffle={maxPrizeRaffleFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Landscape: menos aire lateral, algo más pegado al borde derecho */
              <div className="h-dvh w-screen overflow-hidden flex justify-center items-center py-[10dvh] pl-[3dvw] pr-[1.5dvw]">
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
                        gameId={gameId}
                        orientation="landscape"
                        topX={rankingTopX}
                        prizeLabel={rankingPrizeLabel}
                        prizeCatalog={prizeCatalog}
                        onCounterActiveChange={setCounterActive}
                        onAvatarStateChange={setAvatarState}
                        avatarMediaUrls={avatarMediaUrls}
                        joinChannel={joinChannel}
                        playMode={playMode}
                        logoElement={
                          (customLogo || currentGame.assets?.logo) ? (
                            <div className="flex justify-center items-center w-full min-w-0">
                              <img
                                src={customLogo ?? currentGame.assets!.logo}
                                alt={customLogo ? t('Logo del cliente', 'Client logo') : currentGame.name}
                                className={GAME_SCREEN_LOGO_CLASS_LANDSCAPE}
                              />
                            </div>
                          ) : null
                        }
                        playersElement={
                          <Players gameName={gameName} gameId={gameId ?? undefined} gameType={gameType ?? undefined} compact countersOnly={normalizeGameType(gameType ?? undefined) === 'EMPAREJA2'} prize={prizeCatalog?.validation} prizeLabel={playersPrizeLabel} maxPrizeValidationLimit={maxPrizeValidationFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                        }
                        sidebarElement={
                          <div className="flex flex-col gap-2 w-full min-w-0 min-h-0 flex-1 h-full overflow-y-auto self-stretch">
                            {currentGame.showRanking && (
                              <div className="min-h-0 flex-1 flex flex-col w-full overflow-hidden">
                                <Ranking gameId={gameId} gameType={gameType ?? undefined} compact prize={prizeCatalog?.ranking} prizeLabel={rankingPrizeLabel} topX={rankingTopX} maxPrizeRanking={maxPrizeRankingFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                              </div>
                            )}
                            {features.raffles && (
                              <div className="flex-shrink-0 w-full min-h-[min(32vh,220px)] flex flex-col">
                                <RaffleData gameId={gameId} gameName={gameName} compact prize={prizeCatalog?.raffle} prizeLabel={rafflePrizeLabel} maxPrizeRaffle={maxPrizeRaffleFromSettings} refreshInterval={counterActive ? 0 : 10000} />
                              </div>
                            )}
                            {avatarsEnabled && !currentGame.showRanking && (
                              <div className="min-h-[180px] flex-[1_1_180px] w-full overflow-hidden">
                                <GameStateAvatar
                                  t={t}
                                  state={avatarState}
                                  mediaUrls={avatarMediaUrls}
                                  className="card rounded-xl sm:rounded-2xl shadow-neon w-full h-full min-w-0 overflow-hidden p-2 sm:p-3"
                                />
                              </div>
                            )}
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
            <div
              data-focus-root
              className="card w-full max-w-md sm:max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl p-6 sm:p-8 lg:p-10"
            >
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

        {/* Logo fijo de footer (inmutable) en esquina inferior derecha */}
        <div className={`fixed right-4 bottom-4 opacity-80 hover:opacity-100 transition-opacity z-10 ${isPortrait ? 'w-14 h-14 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20' : 'w-10 h-10 lg:w-12 lg:h-12'}`}>
          <img 
            src="/images/logo-stand-footer.png" 
            alt="Stand" 
            className="w-full h-full object-contain" 
          />
        </div>
      </div>
    </ThemeProvider>
  )
}
