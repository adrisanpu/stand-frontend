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

export function isStackWalletUrl(url: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.kivly.store')
      && !parsed.username && !parsed.password && parsed.pathname === '/add-to-wallet'
  } catch { return false }
}

export function StackWallet({ url, expected = false, onOpen, highlight = true }: {
  url: string | null; expected?: boolean; onOpen?: () => void; highlight?: boolean
}) {
  const { t } = useParticipantLanguage()
  if (!url) return expected ? <p role="status" className="text-sm text-amber-300">
    {t('Tu tarjeta del club no está disponible aquí. Consulta al equipo del evento.')}
  </p> : null
  if (!isStackWalletUrl(url)) return <p role="alert">{t('No se pudo comprobar el enlace de tu wallet.')}</p>
  return <div className="text-center">
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onOpen}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary/30 hover:bg-primary/40 px-4 py-3 text-sm font-semibold ${highlight ? 'wallet-highlight' : ''}`}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6" />
        <path d="M22 12h-6v5h6zM18 14.5h1" />
      </svg>
      {t('Añadir a mi wallet y desbloquear mi premio')}
    </a>
  </div>
}

export default function StackAwardList({ data, locked = false }: { data: StackPlayerPrizes; locked?: boolean }) {
  const { t } = useParticipantLanguage()
  const states: Record<StackAward['state'], string> = {
    available: t('Recógelo mostrando este QR.'),
    delivered: t('Premio recogido. ¡Disfrútalo!'),
    queued: t('Asignando automáticamente a tu cuenta del club…'),
    sending: t('Confirmando la asignación en Kivly…'),
    confirmed: t('Asignado a tu cuenta del club. No necesitas reclamarlo aquí.'),
    reconciliation_required: t('La asignación requiere comprobación del equipo. No vuelvas a solicitarla.'),
    connection_required: t('No se pudo vincular el premio al club. Consulta al equipo del evento.'),
  }
  const emailStates: Record<NonNullable<StackAward['emailState']>, string> = {
    pending: t('Preparando el email de tu premio. No necesitas wallet.'),
    sending: t('Enviando el email de tu premio.'),
    accepted: t('Email de tu premio enviado. Revisa tu bandeja y spam; muestra su QR al personal para canjear en Kivly.'),
    failed: t('No se pudo enviar el email del premio. Consulta al equipo del evento.'),
    reconciliation_required: t('El envío del email requiere comprobación del equipo. No vuelvas a solicitarlo.'),
  }
  return <section aria-label={t('Tus premios')} className="space-y-3 text-left">
    <h2 className="text-lg font-bold">{t('Tus premios')}</h2>
    {data.awards.length === 0 && <p className="text-sm text-textSub">{t('Todavía no tienes premios asignados.')}</p>}
    {data.awards.map((award) => <article key={award.id} className="relative rounded-xl border border-white/10 bg-black/20 p-3">
      <div className={`space-y-2 ${locked ? 'opacity-30' : ''}`}>
      <div className="flex items-center gap-3">
        {award.imageUrl && <img src={award.imageUrl} alt="" className="w-14 h-14 object-contain" />}
        <h3 className="flex-1 min-w-0 font-semibold break-words">{award.name}</h3>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {!locked && award.source === 'stand' && award.state === 'available' && <AwardQR award={award} />}
        <p role="status" className={`text-sm ${award.state.includes('required') ? 'text-amber-300' : 'text-textSub'}`}>{states[award.state]}</p>
      </div>
      {award.deliveryChannel === 'email' && award.state === 'confirmed' && award.emailState && <p role="status" className="text-sm text-textSub">
        {emailStates[award.emailState]}
      </p>}
      {award.emailError === 'KivlyPhoneRequired' && <p role="alert" className="text-sm text-amber-300">
        {t('Falta el teléfono en tu ficha de Kivly. Pide al equipo que lo revise para poder enviarte el QR.')}
      </p>}
      </div>
      {locked && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/10">
        <span role="img" aria-label={t('Abre la wallet para ver tu premio')} className="rounded-full bg-surface p-3 text-primary shadow-lg">
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="12" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" />
          </svg>
        </span>
      </div>}
    </article>)}
    {data.finalPrizesPending && <p className="text-sm text-textSub">{t('El ranking definitivo y sus premios se decidirán al cerrar el juego.')}</p>}
    {data.state === 'closed' && <p className="text-sm text-textSub">{t('Juego cerrado. Tus premios siguen disponibles aquí.')}</p>}
  </section>
}
