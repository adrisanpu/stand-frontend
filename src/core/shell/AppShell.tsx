import { useEffect, useRef, useState } from 'react'
import { ThemeProvider } from '../theme'
import GameGate from './GameGate'
import Ranking from '../widgets/Ranking'
import Players from '../widgets/Players'
import RaffleData from '../widgets/RaffleData'
import HomePrizes, { type HomePrize } from '../widgets/HomePrizes'
import { getGameById } from '../../games'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useOrientation } from '../../hooks/useOrientation'
import { readMaxPrizeValidation, readMaxPrizeRanking, readMaxPrizeRaffle } from '../settings/operatorPrizeSlots'
import { inputManager } from '../input/inputManager'
import { normalizeGameType } from '../gameTypeMap'
import { api } from '../../api/api'
import { fetchUserMedia, resolveUserSelectedLogoUrl, type UserMediaResponse } from '../../api/userMedia'
import { OperatorLanguageProvider, useOperatorLanguage } from './operatorLanguage'
import { usePolling } from '../../hooks/usePolling'
import type { PrizeCatalog } from '../prizes'
import type { StackPrizePromotion } from '../../api/stackPrizes'
import { stackPrizePromotions } from '../widgets/stackPrizePromotions'
import type { OperatorGame } from '../../api/operatorGames'
import type { GameFormConfig } from '../formConfig'
import HomeCanvas from '../home/HomeCanvas'
import HomeAdminButton from '../home/HomeAdminButton'
import { validateHomeCanvas, type HomeCanvasConfig, type HomeBackgroundUrls } from '../home/canvasModel'
import type { ParticipantFieldsConfig } from '../../api/publicApi'
import { profilePhotoEnabled } from '../lib/participantFields'

type AppShellProps = { initialGame?: OperatorGame; onReturnToAdmin?: () => void }
type Metadata = {
  ok: boolean
  game?: { gameType: string; showRaffleOnHome?: boolean; participantFields?: ParticipantFieldsConfig }
  formConfig?: GameFormConfig
  formLogoUrl?: string | null
  prizeCatalog?: PrizeCatalog
  stackPrizeRules?: StackPrizePromotion[]
  homeCanvas: HomeCanvasConfig
  homeBackgroundUrls: HomeBackgroundUrls
}

export default function AppShell(props: AppShellProps) {
  return <OperatorLanguageProvider><AppContent {...props} /></OperatorLanguageProvider>
}

function AppContent({ initialGame, onReturnToAdmin }: AppShellProps) {
  const { language, t } = useOperatorLanguage()
  const { loading: userLoading, plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [gameId, setGameId] = useState<string | null>(() => initialGame?.gameId ?? localStorage.getItem('gameId'))
  const [gameName, setGameName] = useState<string | null>(() => initialGame?.gameName ?? localStorage.getItem('gameName'))
  const [gameType, setGameType] = useState<string | null>(() => initialGame?.gameType ?? localStorage.getItem('gameType'))
  const gameDefinition = getGameById(normalizeGameType(gameType ?? gameId?.split('_')[0]))
  const [userMedia, setUserMedia] = useState<UserMediaResponse | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [mediaError, setMediaError] = useState('')
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState<{ gameId: string; data: Metadata } | null>(null)
  const [loadError, setLoadError] = useState('')
  const current = loaded?.gameId === gameId ? loaded.data : null
  const sourceKey = `${gameId}:${version}`
  const source = useRef(sourceKey)
  source.current = sourceKey
  const isPortrait = useOrientation(true)
  const orientation = isPortrait ? 'portrait' : 'landscape'

  useEffect(() => {
    if (!initialGame) return
    setGameId(initialGame.gameId)
    setGameName(initialGame.gameName)
    setGameType(initialGame.gameType)
  }, [initialGame])
  useEffect(() => {
    for (const [key, value] of [['gameId', gameId], ['gameName', gameName], ['gameType', gameType]]) {
      if (value) localStorage.setItem(key!, value)
      else localStorage.removeItem(key!)
    }
  }, [gameId, gameName, gameType])
  useEffect(() => {
    let active = true
    const loadMedia = async () => {
      try {
        const result = await fetchUserMedia()
        if (!result.ok) throw new Error('No se pudo cargar el aspecto.')
        if (active) { setUserMedia(result); setMediaError('') }
      } catch (reason) {
        if (active) setMediaError(reason instanceof Error ? reason.message : String(reason))
      } finally { if (active) setMediaLoading(false) }
    }
    void loadMedia()
    window.addEventListener('user-media-updated', loadMedia)
    return () => { active = false; window.removeEventListener('user-media-updated', loadMedia) }
  }, [version])
  useEffect(() => {
    const refresh = (event: Event) => {
      const updated = (event as CustomEvent<{ gameId?: string }>).detail?.gameId
      if (updated === gameId) setVersion(value => value + 1)
    }
    window.addEventListener('home-canvas-updated', refresh)
    return () => window.removeEventListener('home-canvas-updated', refresh)
  }, [gameId])
  useEffect(() => { setLoadError('') }, [gameId, version])
  usePolling(async () => {
    if (!gameId) return
    const requested = source.current
    try {
      const data = await api.get<Metadata>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
      if (requested !== source.current) return
      if (!data.ok || !data.game || !validateHomeCanvas(data.homeCanvas) || !data.homeBackgroundUrls) {
        throw new Error(t('No se pudo cargar el lienzo de la partida. Actualiza el backend y reintenta.', 'Could not load the event canvas. Update the backend and retry.'))
      }
      setLoaded({ gameId, data })
      setLoadError('')
    } catch (reason) {
      if (requested === source.current) setLoadError(reason instanceof Error ? reason.message : String(reason))
      throw reason
    }
  }, [gameId, version], { interval: gameId ? 60_000 : 0 })

  const leaveGame = () => {
    if (onReturnToAdmin) { onReturnToAdmin(); return }
    setGameId(null)
    setGameName(null)
    setGameType(null)
    setLoaded(null)
  }
  const backState = useRef({ gameId, leaveGame })
  backState.current = { gameId, leaveGame }
  useEffect(() => inputManager.registerBackInterceptor(() => {
    if (!backState.current.gameId) return false
    backState.current.leaveGame()
    return true
  }), [])
  const [gameSettings, setGameSettings] = useState<Record<string, unknown> | null>(null)
  const definitionId = gameDefinition?.id
  useEffect(() => {
    if (!gameId || !definitionId) { setGameSettings(null); return }
    const saved = localStorage.getItem(`${definitionId}_settings_${gameId}`)
    try { setGameSettings(saved ? JSON.parse(saved) : null) } catch { setGameSettings(null) }
  }, [gameId, definitionId, version])

  const catalog = current?.prizeCatalog
  const isBasket = gameDefinition?.id === 'BASKET'
  const rules = ['STACK', 'BASKET'].includes(gameDefinition?.id ?? '') ? current?.stackPrizeRules : undefined
  const showRaffle = features.raffles && current?.game?.showRaffleOnHome !== false
  const showRanking = !!gameDefinition?.showRanking
  const label = (key: string) => typeof gameSettings?.[key] === 'string' ? gameSettings[key] as string : undefined
  const topX = rules ? Math.max(0, ...rules.filter(rule => rule.condition === 'top_finish' || rule.condition === 'top_final').map(rule => rule.topX ?? 0)) || undefined
    : catalog !== undefined ? catalog.ranking?.topX
    : typeof gameSettings?.topX === 'number' ? gameSettings.topX : undefined
  const homePrizes: HomePrize[] = rules
    ? stackPrizePromotions(rules, t, isBasket
      ? ['score', 'top_finish', 'top_final']
      : ['completed', 'score', 'top_finish', 'top_final', ...(showRaffle ? ['raffle' as const] : [])])
      .map(prize => ({ ...prize, heading: prize.heading || (prize.id.startsWith('raffle:') ? t('Sorteo', 'Raffle') : t('Premio', 'Prize')) }))
    : [
        { slot: 'validation' as const, heading: t('Premio', 'Prize'), prize: catalog !== undefined ? catalog.validation
          : label('prizeValidation') && { name: label('prizeValidation')!, limit: readMaxPrizeValidation(gameSettings) ?? null } },
        ...(showRanking ? [{ slot: 'ranking' as const, heading: topX ? `${t('Premio top', 'Top prize')} ${topX}` : t('Ranking', 'Leaderboard'),
          prize: catalog !== undefined ? catalog.ranking
            : label('prizeTopX') && { name: label('prizeTopX')!, limit: readMaxPrizeRanking(gameSettings) ?? null } }] : []),
        ...(showRaffle ? [{ slot: 'raffle' as const, heading: t('Sorteo', 'Raffle'), prize: catalog !== undefined ? catalog.raffle
          : label('prizeRaffle') && { name: label('prizeRaffle')!, limit: readMaxPrizeRaffle(gameSettings) ?? null } }] : []),
      ].flatMap(({ slot, heading, prize }) => prize && (prize.name || prize.imageUrl) ? [{ ...prize, id: slot, slot, heading }] : [])
  const logo = current?.formLogoUrl ?? (userMedia ? resolveUserSelectedLogoUrl(userMedia) : null) ?? gameDefinition?.assets?.logo
  const hasGame = !!(gameId && gameName && gameDefinition)
  const ready = hasGame && current && !mediaLoading && !userLoading
  const error = loadError || mediaError
  const retry = () => setVersion(value => value + 1)

  return <ThemeProvider game={gameDefinition ?? null} appearance={current?.formConfig?.appearance ?? userMedia?.appearance ?? undefined}>
    <div lang={language} className="relative bg-club text-textMain font-sans h-dvh w-full flex flex-col overflow-hidden">
      <main className="flex-1 min-h-0 min-w-0">
        {ready && gameId && gameName ? <HomeCanvas composition={current.homeCanvas[orientation]} orientation={orientation}
          gameId={gameId} gameName={gameName} logoSrc={logo} backgroundUrl={current.homeBackgroundUrls[orientation]} fit stretch
          players={<Players gameName={gameName} gameId={gameId} gameType={gameType ?? undefined}
            compact countersOnly={gameDefinition?.id === 'EMPAREJA2'} />}
          ranking={showRanking ? <Ranking gameId={gameId} gameType={gameType ?? undefined} compact
            showAvatars={profilePhotoEnabled(current.game?.participantFields)}
            prize={catalog?.ranking} topX={topX}
            maxPrizeRanking={catalog !== undefined ? catalog.ranking?.limit ?? undefined : readMaxPrizeRanking(gameSettings)} /> : undefined}
          raffle={showRaffle ? <RaffleData gameId={gameId} gameName={gameName} compact /> : undefined}
          prizes={<HomePrizes prizes={homePrizes} gameId={gameId} gameName={gameName} />} />
          : hasGame || userLoading ? <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
            <p role={error ? 'alert' : 'status'}>{error || t('Cargando partida…', 'Loading event…')}</p>
            {error && <button type="button" className="underline" onClick={retry}>{t('Reintentar carga', 'Retry loading')}</button>}
          </div> : <div className="h-full overflow-auto grid place-items-center p-6">
            <div className="card w-full max-w-3xl p-6"><GameGate onGameCreated={(name, id, type) => {
              setGameName(name); setGameId(id); setGameType(normalizeGameType(type))
            }} /></div>
          </div>}
      </main>
      {onReturnToAdmin && <HomeAdminButton onClick={onReturnToAdmin} label={t('Administración', 'Administration')} />}
      {ready && error && <p role="alert" className="absolute bottom-3 right-3 z-20 rounded-md bg-black/70 px-3 py-2 text-sm">
        {error} <button type="button" className="underline" onClick={retry}>{t('Reintentar', 'Retry')}</button>
      </p>}
    </div>
  </ThemeProvider>
}
