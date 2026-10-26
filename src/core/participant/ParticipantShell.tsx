import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ThemeProvider } from '../theme'
import { getGameById } from '../../games'
import { normalizeGameType } from '../gameTypeMap'
import { PublicApiError, publicApi, isStackAssignment, type PublicGameResponse, type PlayerAssignment, type T1merAssignment, type StackAssignment, type ImpostorAssignment } from '../../api/publicApi'
import { clearPlayerSession, loadAssignment, loadPlayerToken, savePlayerSession } from './playerSession'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess } from '../settings/gameAccess'
import JoinForm from './JoinForm'
import ParticipantPrizePromo from './ParticipantPrizePromo'
import AssignmentView from './AssignmentView'
import ValidateView from './ValidateView'
import ResultView from './ResultView'
import T1merParticipantPlay from '../../games/t1mer/ParticipantPlay'
import T1merParticipantResult from '../../games/t1mer/ParticipantResult'
import StackParticipantPlay from '../../games/stack/ParticipantPlay'
import ImpostorParticipantPlay from '../../games/impostor/ParticipantPlay'
import { ParticipantLanguageProvider, ParticipantLanguageSelector, useParticipantLanguage } from './participantLanguage'

type Empareja2Step = 'loading' | 'unsupported' | 'join' | 'assignment' | 'validate' | 'result'
type T1merStep = 'loading' | 'unsupported' | 'join' | 'play' | 'result'
type Step = Empareja2Step | T1merStep | 'load-error' | 'registered'

const WEB_PLAY_TYPES = new Set(Object.keys(GAME_ACCESS_CAPABILITIES))

function t1merResultFromAssignment(a: T1merAssignment): {
  time: number
  difference: number
  rank: number | null
} | null {
  if (a.score == null || a.timer == null) return null
  return {
    time: a.timer,
    difference: a.score / 1000,
    rank: null,
  }
}

export default function ParticipantShell() {
  return (
    <ParticipantLanguageProvider>
      <ParticipantContent />
    </ParticipantLanguageProvider>
  )
}

function ParticipantContent() {
  const { language, t } = useParticipantLanguage()
  const { gameId = '' } = useParams()
  const [step, setStep] = useState<Step>('loading')
  const [gameMeta, setGameMeta] = useState<PublicGameResponse | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoUploadWarning, setPhotoUploadWarning] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [prizeRefreshFailed, setPrizeRefreshFailed] = useState(false)
  const activeGameId = useRef(gameId)
  activeGameId.current = gameId
  const [stackAssignment, setStackAssignment] = useState<StackAssignment | null>(null)
  const [impostorAssignment, setImpostorAssignment] = useState<ImpostorAssignment | null>(null)
  const [t1merResult, setT1merResult] = useState<{
    time: number
    difference: number
    rank: number | null
  } | null>(null)

  const currentGameMeta = gameMeta?.gameId === gameId ? gameMeta : null
  const gameType = currentGameMeta ? normalizeGameType(currentGameMeta.gameType) : ''
  const game = getGameById(gameType)
  const logo = currentGameMeta ? currentGameMeta.clientLogoUrl || game?.assets?.logo : undefined
  const isMobile = gameMeta && WEB_PLAY_TYPES.has(gameType)
    ? resolveGameAccess(gameType, gameMeta).playMode === 'mobile' : false
  const hasPrizeCatalog = currentGameMeta?.prizeCatalog !== undefined

  const refreshPrizes = useCallback(async () => {
    try {
      const meta = await publicApi.getGame(gameId)
      if (activeGameId.current !== gameId) return
      if (!meta.ok || meta.gameId !== gameId) throw new Error('Invalid game metadata')
      setGameMeta((previous) => previous?.gameId === gameId
        ? { ...previous, prizeCatalog: meta.prizeCatalog }
        : previous)
      setPrizeRefreshFailed(false)
    } catch {
      if (activeGameId.current === gameId) setPrizeRefreshFailed(true)
    }
  }, [gameId])

  useEffect(() => {
    setPrizeRefreshFailed(false)
    if (!hasPrizeCatalog) return
    let lastRefresh = Date.now()
    const refresh = () => {
      lastRefresh = Date.now()
      void refreshPrizes()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh >= 30 * 60 * 1000) refresh()
    }
    const interval = window.setInterval(refresh, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [gameId, hasPrizeCatalog, refreshPrizes])

  const applyAssignment = useCallback((meta: PublicGameResponse, token: string, assignment: PlayerAssignment | null) => {
    const gt = normalizeGameType(meta.gameType)
    if (!assignment) throw new Error('No se pudo recuperar tu participante. Solicita un nuevo enlace de participación.')
    if (gt === 'STACK' && !isStackAssignment(assignment)) throw new Error('No se pudo recuperar tu participante.')
    if (gt === 'EMPAREJA2' && !('characterName' in assignment)) throw new Error('No se pudo recuperar tu participante.')
    if (gt === 'T1MER' && (!('displayName' in assignment) || isStackAssignment(assignment))) {
      throw new Error('No se pudo recuperar tu participante.')
    }
    if (gt === 'IMPOSTOR' && (!('displayName' in assignment) || isStackAssignment(assignment))) {
      throw new Error('No se pudo recuperar tu participante.')
    }
    savePlayerSession(gameId, token, assignment)
    setPlayerToken(token)
    if (gt === 'IMPOSTOR' && 'displayName' in assignment && !isStackAssignment(assignment)) {
      setImpostorAssignment(assignment)
      setStep('play')
    } else if (gt !== 'EMPAREJA2' && gt !== 'T1MER' && gt !== 'STACK') {
      setStep('registered')
    } else if (isStackAssignment(assignment)) {
      setStackAssignment(assignment)
      setStep('play')
    } else if (gt === 'T1MER' && 'displayName' in assignment) {
      const result = t1merResultFromAssignment(assignment)
      setT1merResult(result)
      setStep(result ? 'result' : 'play')
    } else {
      setStep('validated' in assignment && assignment.validated ? 'result' : 'assignment')
    }
  }, [gameId])

  useEffect(() => {
    let cancelled = false
    setStep('loading')
    setError(null)
    setPhotoUploadWarning(false)
    setStackAssignment(null)
    setImpostorAssignment(null)
    ;(async () => {
      if (!gameId) {
        setStep('unsupported')
        return
      }
      try {
        const meta = await publicApi.getGame(gameId)
        if (cancelled) return
        if (!meta.ok || meta.gameId !== gameId || !meta.isActive) {
          setStep('unsupported')
          return
        }
        const gt = normalizeGameType(meta.gameType)
        if (!WEB_PLAY_TYPES.has(gt)) {
          setStep('unsupported')
          return
        }
        resolveGameAccess(gt, meta)
        setGameMeta(meta)
        const token = loadPlayerToken(gameId)
        if (token) {
          let player
          try {
            player = await publicApi.getPlayer(token, gameId)
          } catch (sessionError) {
            if (cancelled) return
            if (sessionError instanceof PublicApiError
              && [401, 403, 404].includes(sessionError.status)
              && ['InvalidPlayerToken', 'PlayerNotFound', 'KivlyMembershipRequired', 'KivlyConsentRequired'].includes(sessionError.code ?? '')) {
              clearPlayerSession(gameId)
              setPlayerToken(null)
              setT1merResult(null)
              setStep('join')
              return
            }
            throw sessionError
          }
          if (cancelled) return
          if (!player.ok || player.gameId !== gameId || normalizeGameType(player.gameType) !== gt || !player.playerToken) {
            throw new Error('El enlace o la sesión de participante no es válido.')
          }
          applyAssignment(meta, player.playerToken, player.assignment)
        } else {
          setStep('join')
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el juego')
          const rejected = e instanceof PublicApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429
          setStep(rejected ? 'unsupported' : 'load-error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, loadVersion, applyAssignment])

  return (
    <ThemeProvider game={game ?? null} appearance={gameMeta?.appearance}>
      <div
        lang={language}
        className="min-h-dvh bg-club text-textMain font-sans px-4 py-6"
        style={gameType === 'STACK' ? {
          paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        } : undefined}
      >
        <div className="relative mx-auto max-w-md w-full flex flex-col">
          <ParticipantPrizePromo catalog={currentGameMeta?.prizeCatalog} stickers />
          <div className="relative w-full">
          <ParticipantLanguageSelector />
        <div className="card relative w-full p-6 pt-14 space-y-5">
          {logo && (
            <img
              src={logo}
              alt={currentGameMeta?.clientLogoUrl ? t('Logo del cliente') : game?.name}
              className="mx-auto h-32 w-auto max-w-full object-contain"
            />
          )}
          {prizeRefreshFailed && (
            <div role="alert" className="space-y-2 text-sm text-red-300">
              <p>{t('No se pudieron actualizar los premios.')}</p>
              <button type="button" onClick={() => void refreshPrizes()} className="underline">
                {t('Reintentar actualización de premios')}
              </button>
            </div>
          )}
          {photoUploadWarning && (
            <p role="status" className="text-sm text-amber-300">
              {t('No se pudo guardar la foto; se muestra el avatar genérico.')}
            </p>
          )}
          {step === 'loading' && <p className="text-center text-textSub">{t('Cargando...')}</p>}
          {step === 'unsupported' && (
            <div className="text-center space-y-2">
              <p className="font-semibold">{t('Juego no disponible')}</p>
              <p className="text-sm text-textSub">
                {t(error || 'Este enlace no es válido o el juego no admite participación web todavía.')}
              </p>
            </div>
          )}
          {step === 'load-error' && (
            <div className="text-center space-y-3">
              <p className="font-semibold">{t('No se pudo cargar el juego')}</p>
              <p role="alert" className="text-sm text-textSub">{error && t(error)}</p>
              <button
                type="button"
                onClick={() => setLoadVersion((version) => version + 1)}
                className="w-full rounded-xl py-3 font-bold text-primary bg-[rgba(var(--color-primary-rgb),0.2)] border border-[rgba(var(--color-primary-rgb),0.3)]"
              >
                {t('Reintentar carga')}
              </button>
            </div>
          )}
          {step === 'join' && gameMeta && (
            <JoinForm
              gameId={gameId}
              gameMeta={gameMeta}
              onJoined={(token, photoUploadFailed) => {
                setPhotoUploadWarning(Boolean(photoUploadFailed))
                applyAssignment(gameMeta, token, loadAssignment(gameId))
              }}
            />
          )}

          {step === 'registered' && (
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold">{t('¡Ya estás dentro!')}</h1>
              <p className="text-sm text-textSub">{t('Sigue las instrucciones del evento para jugar.')}</p>
            </div>
          )}

          {gameType === 'STACK' && step === 'play' && stackAssignment && playerToken && (
            <StackParticipantPlay key={`${gameId}:${stackAssignment.playerId}`} gameId={gameId} playerToken={playerToken} config={gameMeta?.stackConfig} assignment={stackAssignment} startSupported={gameMeta?.stackStartSnapshot === true} finishSupported={gameMeta?.stackFinishSupported === true} prizeCatalog={currentGameMeta?.prizeCatalog} showPrizePromo={false} kivlyRewardEnabled={!!currentGameMeta?.loyalty} />
          )}

          {gameType === 'IMPOSTOR' && step === 'play' && impostorAssignment && playerToken && (
            <ImpostorParticipantPlay
              key={`${gameId}:${impostorAssignment.playerId}`}
              gameId={gameId}
              playerToken={playerToken}
              initialAssignment={impostorAssignment}
            />
          )}

          {gameType === 'EMPAREJA2' && step === 'assignment' && gameMeta && playerToken && (
            <AssignmentView
              gameId={gameId}
              gameMeta={gameMeta}
              playerToken={playerToken}
              showPrizePromo={false}
              onValidate={() => setStep('validate')}
            />
          )}
          {gameType === 'EMPAREJA2' && isMobile && step === 'validate' && playerToken && (
            <ValidateView
              gameId={gameId}
              playerToken={playerToken}
              onResult={() => setStep('result')}
              onBack={() => setStep('assignment')}
            />
          )}
          {gameType === 'EMPAREJA2' && step === 'result' && (
            <ResultView gameId={gameId} prizeCatalog={currentGameMeta?.prizeCatalog} />
          )}

          {gameType === 'T1MER' && isMobile && step === 'play' && playerToken && (
            <T1merParticipantPlay
              gameId={gameId}
              playerToken={playerToken}
              onFinished={(result) => {
                setT1merResult(result)
                setStep('result')
              }}
            />
          )}
          {gameType === 'T1MER' && step === 'result' && t1merResult && (
            <T1merParticipantResult
              gameId={gameId}
              time={t1merResult.time}
              difference={t1merResult.difference}
              rank={t1merResult.rank}
              prizeCatalog={currentGameMeta?.prizeCatalog}
              showPrizePromo={false}
            />
          )}
        </div>
        </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
