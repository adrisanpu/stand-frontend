import { useEffect, useState } from 'react'
import { publicApi, type NativePrizeAward, type PlayerResponse } from '../../api/publicApi'
import { inventoryReasonText } from '../inventoryReason'
import QRCode from '../widgets/QRCode'
import { useParticipantLanguage } from './participantLanguage'
import WalletPassLinks from './WalletPassLinks'

export default function NativePrizeClaims({ gameId, playerToken, initialAwards, initialUnavailable = [] }: {
  gameId: string; playerToken: string; initialAwards: NativePrizeAward[]
  initialUnavailable?: NonNullable<PlayerResponse['prizeUnavailable']>
}) {
  const { t, language } = useParticipantLanguage()
  const [awards, setAwards] = useState<NativePrizeAward[]>(initialAwards)
  const [unavailable, setUnavailable] = useState(initialUnavailable)
  const [error, setError] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  const refreshAwards = async () => {
    const result = await publicApi.getPlayer(playerToken, gameId)
    if (!result.ok || result.gameId !== gameId) throw new Error('Invalid prize response')
    setAwards(result.nativePrizes ?? [])
    setUnavailable(result.prizeUnavailable ?? [])
  }
  const retryEmail = async (awardId: string) => {
    setRetrying(awardId)
    setEmailError(false)
    try {
      await publicApi.retryRewardEmail(gameId, playerToken, awardId)
      await refreshAwards()
    } catch {
      setEmailError(true)
    } finally {
      setRetrying(null)
    }
  }
  const emailStates = {
    pending: t('Preparando el email de tu premio.'),
    sending: t('Enviando el email de tu premio.'),
    accepted: t('Email aceptado para envío. Revisa tu bandeja y spam.'),
    failed: t('No se pudo enviar el email del premio.'),
    reconciliation_required: t('El envío del email requiere comprobación del equipo.'),
  }
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const result = await publicApi.getPlayer(playerToken, gameId)
        if (!result.ok || result.gameId !== gameId) throw new Error('Invalid prize response')
        if (!cancelled) {
          setAwards(result.nativePrizes ?? []); setUnavailable(result.prizeUnavailable ?? []); setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    const timer = window.setInterval(refresh, 30000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [gameId, playerToken])
  if (!awards.length && !unavailable.length && !error) return null
  return <section aria-label={t('Tus premios')} className="space-y-3">
    <h2 className="text-lg font-bold">{t('Tus premios')}</h2>
    {error && <p role="alert">{t('No se pudieron actualizar los premios.')}</p>}
    {!error && unavailable.length > 0 && <p role="status" className="text-sm text-textSub">
      {[...new Set(unavailable.map(item => inventoryReasonText(item.reason, language)))].join(' ')}
    </p>}
    {awards.map(award => <article key={award.id} className="rounded-xl border border-current/20 p-3 space-y-2">
      <h3 className="font-semibold">{award.name}</h3>
      {award.imageUrl && <img src={award.imageUrl} alt="" className="mx-auto h-16 w-16 object-contain" />}
      {award.state === 'available' && award.token && !error
        ? <>
          <QRCode data={award.token} size={220} alt={`QR ${award.name}`} className="!bg-white !p-3" />
          <WalletPassLinks token={award.token} />
        </>
        : <p>{t(award.state === 'delivered' ? 'Premio(s) ya recogido(s). ¡Disfrutad!' : 'No se pudieron actualizar los premios.')}</p>}
      {award.emailState && <p role="status" className="text-sm text-textSub">{emailStates[award.emailState]}</p>}
      {award.emailState === 'failed' && <button type="button" className="underline text-sm"
        disabled={retrying !== null} onClick={() => void retryEmail(award.id)}>
        {retrying === award.id ? t('Reintentando…') : t('Reintentar email')}
      </button>}
    </article>)}
    {emailError && <p role="alert">{t('No se pudo reintentar el email.')}</p>}
  </section>
}
