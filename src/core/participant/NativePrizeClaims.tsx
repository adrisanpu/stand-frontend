import { useEffect, useState } from 'react'
import { publicApi, type NativePrizeAward, type PlayerResponse } from '../../api/publicApi'
import { inventoryReasonText } from '../inventoryReason'
import QRCode from '../widgets/QRCode'
import { useParticipantLanguage } from './participantLanguage'
import PrizeEmailNotice from './PrizeEmailNotice'

export default function NativePrizeClaims({ gameId, playerToken, initialAwards, initialUnavailable = [], initialEmailOnly = false }: {
  gameId: string; playerToken: string; initialAwards: NativePrizeAward[]
  initialUnavailable?: NonNullable<PlayerResponse['prizeUnavailable']>
  initialEmailOnly?: boolean
}) {
  const { t, language } = useParticipantLanguage()
  const [awards, setAwards] = useState<NativePrizeAward[]>(initialAwards)
  const [unavailable, setUnavailable] = useState(initialUnavailable)
  const [emailOnly, setEmailOnly] = useState(initialEmailOnly)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const result = await publicApi.getPlayer(playerToken, gameId)
        if (!result.ok || result.gameId !== gameId) throw new Error('Invalid prize response')
        if (!cancelled) {
          setAwards(result.nativePrizes ?? []); setUnavailable(result.prizeUnavailable ?? []); setError(false)
          setEmailOnly(result.prizeNotification?.play === false)
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
      {award.state === 'available' && emailOnly
        ? <PrizeEmailNotice />
        : award.state === 'available' && award.token && !error
        ? <QRCode data={award.token} size={220} alt={`QR ${award.name}`} className="!bg-white !p-3" />
        : award.state !== 'delivered' && <p>{t('No se pudieron actualizar los premios.')}</p>}
    </article>)}
    {awards.length > 0 && awards.every(award => award.state === 'delivered') && (
      <p className="text-sm text-textSub">{t('Mirad la pantalla del evento para ver el resultado en vivo.')}</p>
    )}
  </section>
}
