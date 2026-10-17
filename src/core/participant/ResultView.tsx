import { useEffect, useState } from 'react'
import { publicApi, type PlayerPrize } from '../../api/publicApi'
import { loadPlayerToken } from './playerSession'
import QRCode from '../widgets/QRCode'
import { useParticipantLanguage } from './participantLanguage'

type Props = {
  gameId: string
  onPlayAgain?: () => void
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

export default function ResultView({ gameId, onPlayAgain }: Props) {
  const { t } = useParticipantLanguage()
  const [prizes, setPrizes] = useState<PlayerPrize[]>([])
  const [loading, setLoading] = useState(true)

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
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
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

      {pending.map((p) => (
        <div key={p.kind} className="space-y-2">
          <p className="text-sm font-medium">{t(PRIZE_LABEL[p.kind] || p.kind)}</p>
          <QRCode data={p.token} size={220} alt={`QR ${t(PRIZE_LABEL[p.kind] || p.kind)}`} className="!bg-white !p-3" />
        </div>
      ))}

      {delivered.length > 0 && pending.length === 0 && (
        <p className="text-sm text-green-300/90">{t('Premio(s) ya recogido(s). ¡Disfrutad!')}</p>
      )}

      {onPlayAgain && <button
        type="button"
        onClick={onPlayAgain}
        className="w-full rounded-xl py-3 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.2)] border border-[rgba(var(--color-primary-rgb),0.35)]"
      >
        {t('Validar otra pareja')}
      </button>}
    </div>
  )
}
