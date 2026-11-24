import { useEffect, useState } from 'react'
import { publicApi, type KivlyCompletionReward } from '../../api/publicApi'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

export default function KivlyRewardCard({ gameId, playerToken }: { gameId: string; playerToken: string }) {
  const { t } = useParticipantLanguage()
  const [reward, setReward] = useState<KivlyCompletionReward | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void publicApi.completionReward(gameId, playerToken).then((result) => {
      if (cancelled) return
      setReward(result)
      setStatus('ready')
    }).catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [gameId, playerToken, revision])
  if (reward?.status === 'none' && status === 'ready') return null
  const available = reward?.status === 'confirmed'
  return <section aria-label={t('Tu premio del club')} className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-3 text-center">
    <p className="text-xs uppercase tracking-widest text-accent font-semibold">{t('Tu premio del club')}</p>
    {reward?.name && <h3 className="text-xl font-bold">{reward.name}</h3>}
    {status === 'loading' && <p role="status" className="text-sm text-textSub">{t('Confirmando tu premio...')}</p>}
    {status === 'error' && <p role="alert" className="text-sm text-red-300">{t('No se pudo comprobar tu premio. Tu resultado está guardado.')}</p>}
    {status === 'ready' && available && <>
      <p role="status" className="text-sm text-textSub">{t('Premio asignado a tu cuenta del club.')}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {reward.appleWalletUrl && <a href={reward.appleWalletUrl} target="_blank" rel="noopener noreferrer"
          className="rounded-xl bg-black text-white border border-white/20 px-5 py-3 font-semibold">Apple Wallet</a>}
        {reward.googleWalletUrl && <a href={reward.googleWalletUrl} target="_blank" rel="noopener noreferrer"
          className="rounded-xl bg-white text-black border border-black/10 px-5 py-3 font-semibold">Google Wallet</a>}
      </div>
      {!reward.appleWalletUrl && !reward.googleWalletUrl && <p className="text-sm text-textSub">{t('Tarjeta no disponible todavía.')}</p>}
    </>}
    {status === 'ready' && reward?.status === 'pending' && <p role="status" className="text-sm text-textSub">
      {t('Tu premio está pendiente de comprobación. Consulta al equipo del evento; no se volverá a asignar automáticamente.')}
    </p>}
    {status !== 'loading' && <button type="button" onClick={() => setRevision((value) => value + 1)}
      className="rounded-xl border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary/10">
      {t('Comprobar premio')}
    </button>}
  </section>
}
