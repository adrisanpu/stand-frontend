import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { publicApi, type PlayerPrize } from '../../api/publicApi'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import type { PrizeCatalog } from '../../core/prizes'
import { PrizeImage } from '../../core/widgets/PrizePresentation'

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

export default function RankingPrizeClaim({ gameId, playerToken, prizeCatalog, children, rank, enabled = true }: Props) {
  const { t } = useParticipantLanguage()
  const [prize, setPrize] = useState<PlayerPrize | null>(null)
  const [catalog, setCatalog] = useState<PrizeCatalog | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((previous) => previous + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let busy = false
    setPrize(null)
    setCatalog(undefined)
    setLoading(true)
    setLoadError(false)
    const load = async () => {
      if (busy) return
      busy = true
      try {
        const result = await publicApi.getPlayer(playerToken, gameId)
        if (!result.ok || result.gameId !== gameId || result.gameType !== 'STACK') {
          throw new Error('Invalid prize response')
        }
        if (cancelled) return
        setPrize(result.prizes.find((entry) => entry.kind === 'ranking') ?? null)
        setCatalog(result.prizeCatalog)
        setLoadError(false)
      } catch {
        if (!cancelled) {
          setPrize(null)
          setLoadError(true)
        }
      } finally {
        busy = false
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const interval = window.setInterval(() => void load(), 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [gameId, playerToken, revision, enabled])

  const rankingPrize = (catalog ?? prizeCatalog)?.ranking
  return (
    <>
      <div className="stack-viewport relative w-full h-[45vh] min-h-[220px] max-h-[440px] rounded-xl overflow-hidden border border-primary/20">
        {children}
        {enabled && (rank != null || prize) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black/70 text-white p-3 sm:p-4" aria-live="polite">
            {rank != null && (
              <h2 className="shrink-0 text-4xl sm:text-5xl font-bold tabular-nums">
                {t('Posición: ')}<span>#{rank}</span>
              </h2>
            )}
            {prize && (
              <div className="flex w-full max-w-sm min-h-0 items-center justify-center gap-4">
                {rankingPrize && (
                  <div className="flex w-[clamp(100px,18vh,180px)] max-w-[calc(50%-0.5rem)] min-w-0 flex-col items-center gap-2 text-center">
                    <PrizeImage prize={rankingPrize} className="h-[clamp(48px,12vh,112px)] w-full object-contain" />
                    <p className="w-full font-semibold break-words [overflow-wrap:anywhere]">{rankingPrize.name}</p>
                  </div>
                )}
                {!prize.delivered && (
                  <div className="w-[clamp(100px,18vh,180px)] max-w-[calc(50%-0.5rem)] shrink-0">
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
          ) : prize && (
            prize.delivered
              ? <p role="status" className="text-sm text-green-300">{t('Premio(s) ya recogido(s). ¡Disfrutad!')}</p>
              : <p className="text-sm text-textSub">{t('Muestra este QR en el punto de recogida para canjear tu premio.')}</p>
          )
      )}
    </>
  )
}
