import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import type { StackAward, StackPlayerPrizes } from '../../api/stackPrizes'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

function AwardQR({ award }: { award: StackAward }) {
  const source = useMemo(() => {
    if (!award.token) return ''
    const qr = qrcode(0, 'M')
    qr.addData(award.token)
    qr.make()
    return qr.createDataURL(4, 12)
  }, [award.token])
  return source ? <img src={source} alt={`QR ${award.name}`} className="w-36 h-36 rounded-xl bg-white shrink-0" /> : null
}

export function StackWallet({ url, expected = false }: { url: string | null; expected?: boolean }) {
  const { t } = useParticipantLanguage()
  if (!url) return expected ? <p role="status" className="text-sm text-amber-300">
    {t('Tu tarjeta del club no está disponible aquí. Consulta al equipo del evento.')}
  </p> : null
  let safe = false
  try {
    const parsed = new URL(url)
    safe = parsed.protocol === 'https:' && parsed.hostname.endsWith('.kivly.store')
      && !parsed.username && !parsed.password && parsed.pathname === '/add-to-wallet'
  } catch { safe = false }
  if (!safe) return <p role="alert">{t('No se pudo comprobar el enlace de tu wallet.')}</p>
  return <section className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-2 text-center">
    <h2 className="text-lg font-bold">{t('Tu tarjeta del club')}</h2>
    <p className="text-sm text-textSub">{t('Guárdala en Apple Wallet o Google Wallet. Los premios Kivly se asignan automáticamente a tu cuenta.')}</p>
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-white text-black px-6 py-3 font-semibold">
      {t('Añadir a mi wallet')}
    </a>
  </section>
}

export default function StackAwardList({ data }: { data: StackPlayerPrizes }) {
  const { t } = useParticipantLanguage()
  const labels: Record<StackAward['condition'], string> = {
    completed: t('Por completar la partida'),
    top_finish: t('Por tu posición al terminar'),
    top_final: t('Por tu posición final'),
    raffle: t('Por ganar el sorteo'),
  }
  const states: Record<StackAward['state'], string> = {
    available: t('Recógelo mostrando este QR.'),
    delivered: t('Premio recogido. ¡Disfrútalo!'),
    queued: t('Asignando automáticamente a tu cuenta del club…'),
    sending: t('Confirmando la asignación en Kivly…'),
    confirmed: t('Asignado a tu cuenta del club. No necesitas reclamarlo aquí.'),
    reconciliation_required: t('La asignación requiere comprobación del equipo. No vuelvas a solicitarla.'),
    connection_required: t('No se pudo vincular el premio al club. Consulta al equipo del evento.'),
  }
  return <section aria-label={t('Tus premios')} className="space-y-3 text-left">
    <h2 className="text-lg font-bold">{t('Tus premios')}</h2>
    {data.awards.length === 0 && <p className="text-sm text-textSub">{t('Todavía no tienes premios asignados.')}</p>}
    {data.awards.map((award) => <article key={award.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="flex items-center gap-3">
        {award.imageUrl && <img src={award.imageUrl} alt="" className="w-14 h-14 object-contain" />}
        <div className="flex-1 min-w-0"><p className="text-xs text-textSub">{labels[award.condition]}</p>
          <h3 className="font-semibold break-words">{award.name}</h3></div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-xs">{award.source === 'stand' ? 'STAND · QR' : 'Kivly · Wallet'}</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {award.source === 'stand' && award.state === 'available' && <AwardQR award={award} />}
        <p role="status" className={`text-sm ${award.state.includes('required') ? 'text-amber-300' : 'text-textSub'}`}>{states[award.state]}</p>
      </div>
    </article>)}
    {data.finalPrizesPending && <p className="text-sm text-textSub">{t('El ranking definitivo y sus premios se decidirán al cerrar el juego.')}</p>}
    {data.state === 'closed' && <p className="text-sm text-textSub">{t('Juego cerrado. Tus premios siguen disponibles aquí.')}</p>}
  </section>
}
