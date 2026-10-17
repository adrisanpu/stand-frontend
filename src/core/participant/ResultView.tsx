import { useEffect, useState } from 'react'
import { publicApi, type PlayerPrize } from '../../api/publicApi'
import { loadPlayerToken } from './playerSession'
import QRCode from '../widgets/QRCode'
import { useParticipantLanguage } from './participantLanguage'
import type { PrizeCatalog } from '../prizes'
import PrizePresentation from '../widgets/PrizePresentation'

type Props = {
  gameId: string
  prizeCatalog?: PrizeCatalog
}

const PRIZE_LABEL: Record<string, string> = {
  validation: 'Premio por pareja',
  raffle: 'Premio del sorteo',
}

// ponytail: 30s poll is enough while players sit on result; move to push/WebSocket if concurrent result viewers spike.
const POLL_MS = 30000

/** Keep the first pending token per kind so the QR image stays stable across polls. */
function mergePrizes(prev: PlayerPrize[], next: PlayerPrize[]): PlayerPrize[] {
  return next.map((n) => {
    const old = prev.find((p) => p.kind === n.kind)
    if (old && !n.delivered && !old.delivered) {
      return { ...n, token: old.token }
    }
    return n
  })
}

export default function ResultView({ gameId, prizeCatalog }: Props) {
  const { t } = useParticipantLanguage()
  const [prizes, setPrizes] = useState<PlayerPrize[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogResponse, setCatalogResponse] = useState<{ gameId: string; catalog: PrizeCatalog } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const catalog = catalogResponse?.gameId === gameId ? catalogResponse.catalog : prizeCatalog

  useEffect(() => {
    const token = loadPlayerToken(gameId)
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await publicApi.getPlayer(token, gameId)
        if (!cancelled) {
          setPrizes((prev) => mergePrizes(prev, res.prizes || []))
          if (res.prizeCatalog !== undefined) setCatalogResponse({ gameId, catalog: res.prizeCatalog })
          setLoadError(false)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
          setLoadError(true)
        }
      }
    }
    void load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [gameId])

  const pending = prizes.filter((p) => !p.delivered)
  const delivered = prizes.filter((p) => p.delivered)

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl" aria-hidden>✓</div>
      <h2 className="text-2xl font-bold text-green-300">{t('¡Pareja válida!')}</h2>
      <p className="text-textSub">
        {t(pending.length > 0
          ? 'Muestra este QR en el punto de recogida para canjear tu premio.'
          : 'Mirad la pantalla del evento para ver el resultado en vivo.')}
      </p>

      {loading && <p className="text-sm text-textSub">{t('Cargando premios...')}</p>}
      {loadError && <p role="alert" className="text-sm text-red-300">{t('No se pudieron actualizar los premios.')}</p>}

      {pending.map((p) => (
        <div key={p.kind} className="space-y-2">
          <p className="text-sm font-medium">{t(PRIZE_LABEL[p.kind] || p.kind)}</p>
          <PrizePresentation prize={catalog?.[p.kind]} />
          <QRCode data={p.token} size={220} alt={`QR ${t(PRIZE_LABEL[p.kind] || p.kind)}`} className="!bg-white !p-3" />
        </div>
      ))}

      {delivered.length > 0 && pending.length === 0 && (
        <div className="space-y-3">
          {delivered.map((prize) => <PrizePresentation key={prize.kind} prize={catalog?.[prize.kind]} />)}
          <p className="text-sm text-green-300/90">{t('Premio(s) ya recogido(s). ¡Disfrutad!')}</p>
        </div>
      )}
    </div>
  )
}
