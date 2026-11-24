import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { publicApi, type PlayerPrize } from '../../api/publicApi'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import type { PrizeCatalog } from '../../core/prizes'
import { PrizeImage } from '../../core/widgets/PrizePresentation'
import type { StackPlayerPrizes } from '../../api/stackPrizes'
import StackAwardList, { StackWallet } from './StackAwardList'

type Props = {
  gameId: string
  playerToken: string
  prizeCatalog?: PrizeCatalog
  children?: ReactNode
  rank?: number | null
  enabled?: boolean
}

function PrizeQR({ token, label }: { token: string; label: string }) {
  const source = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(token)
    code.make()
    return code.createDataURL(4, 16)
  }, [token])

  return <img src={source} alt={label} className="w-full max-w-[180px] aspect-square rounded-xl border border-white/10" />
}

const FAST_POLL_MS = 2000
const SLOW_POLL_MS = 30000
const MAX_FAST_POLLS = 60

function PrizePendingIndicator() {
  const { t } = useParticipantLanguage()
  return (
    <div role="status" aria-live="polite" className="flex shrink-0 flex-col items-center gap-2 text-center">
      <div className="relative h-16 w-16">
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-3xl animate-bounce">🎁</span>
      </div>
      <p className="text-sm font-semibold">{t('Preparando tu premio…')}</p>
    </div>
  )
}

export default function RankingPrizeClaim({ gameId, playerToken, prizeCatalog, children, rank, enabled = true }: Props) {
  const { t } = useParticipantLanguage()
  const [prize, setPrize] = useState<PlayerPrize | null>(null)
  const [catalog, setCatalog] = useState<PrizeCatalog | undefined>()
  const [stackPrizes, setStackPrizes] = useState<StackPlayerPrizes | undefined>()
  const [emailOnly, setEmailOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((previous) => previous + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let busy = false
    let timer: number | undefined
    let fastPolls = 0
    setPrize(null)
    setCatalog(undefined)
    setStackPrizes(undefined)
    setLoading(true)
    setLoadError(false)
    const load = async () => {
      if (busy) return
      busy = true
      let pending = false
      try {
        const result = await publicApi.getPlayer(playerToken, gameId)
        if (!result.ok || result.gameId !== gameId || result.gameType !== 'STACK') {
          throw new Error('Invalid prize response')
        }
        if (cancelled) return
        pending = result.stackPrizes?.pending === true
        setPrize(result.prizes.find((entry) => entry.kind === 'ranking') ?? null)
        setCatalog(result.prizeCatalog)
        setStackPrizes(result.stackPrizes)
        setEmailOnly(result.prizeNotification?.play === false)
        setLoadError(false)
      } catch {
        if (!cancelled) {
          setPrize(null)
          setLoadError(true)
        }
      } finally {
        busy = false
        if (!cancelled) {
          setLoading(false)
          const fast = pending && fastPolls < MAX_FAST_POLLS
          if (fast) fastPolls += 1
          timer = window.setTimeout(() => void load(), fast ? FAST_POLL_MS : SLOW_POLL_MS)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [gameId, playerToken, revision, enabled])

  const rankingPrize = (catalog ?? prizeCatalog)?.ranking
  const prizePending = enabled && stackPrizes?.pending === true
  const overlayVisible = enabled && (rank != null || prize)
  return (
    <>
      <div className="stack-viewport relative w-full h-[45vh] min-h-[220px] max-h-[440px] rounded-xl overflow-hidden border border-primary/20">
        {children}
        {overlayVisible && (
          <div className="absolute inset-0 flex flex-col items-center gap-3 overflow-y-auto bg-black/70 text-white p-3 sm:p-4 before:content-[''] before:my-auto after:content-[''] after:my-auto" aria-live="polite">
            {rank != null && (
              <h2 className="shrink-0 text-4xl sm:text-5xl font-bold tabular-nums">
                {t('Posición: ')}<span>#{rank}</span>
              </h2>
            )}
            {prizePending && <PrizePendingIndicator />}
            {prize && (
              <div className="flex w-full max-w-sm shrink-0 items-center justify-center gap-4">
                {rankingPrize && (
                  <div className="flex w-[clamp(100px,18vh,180px)] max-w-[calc(50%-0.5rem)] min-w-0 flex-col items-center gap-2 text-center">
                    <PrizeImage prize={rankingPrize} className="h-[clamp(48px,12vh,112px)] w-full object-contain" />
                    <p className="w-full font-semibold break-words [overflow-wrap:anywhere]">{rankingPrize.name}</p>
                  </div>
                )}
                {!prize.delivered && (
                  <div className="w-[clamp(100px,18vh,180px)] max-w-[calc(50%-0.5rem)] shrink-0 space-y-2">
                    <PrizeQR token={prize.token} label={`QR ${t('Premio del ranking')}`} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {enabled && (
        loading ? <p role="status" className="text-sm text-textSub">{t('Cargando premios...')}</p>
          : loadError ? (
            <div role="alert" className="space-y-2 text-sm text-red-300">
              <p>{t('No se pudieron actualizar los premios.')}</p>
              <button type="button" onClick={retry} className="underline">{t('Reintentar actualización de premios')}</button>
            </div>
          ) : prizePending && !overlayVisible ? <PrizePendingIndicator />
          : prize?.delivered ? (
            <p role="status" className="text-sm text-textSub">
              {t('Mirad la pantalla del evento para ver el resultado en vivo.')}
            </p>
          ) : null
      )}
      {enabled && stackPrizes && <>
        <StackWallet url={stackPrizes.walletUrl} expected={stackPrizes.walletExpected} />
        <StackAwardList data={stackPrizes} gameId={gameId} playerToken={playerToken} onRefresh={retry} emailOnly={emailOnly} />
      </>}
    </>
  )
}
