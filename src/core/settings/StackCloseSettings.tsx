import IconButton from '../ui/IconButton'
import { useEffect, useRef, useState } from 'react'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { OperatorLanguageSelector, useOperatorLanguage } from '../shell/operatorLanguage'

export default function StackCloseSettings({ gameId, onBack, onClose, onLeave, onSavingChange }: {
  gameId: string
  onBack: () => void
  onClose: () => void
  onLeave?: () => void
  onSavingChange: (busy: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const [data, setData] = useState<StackPrizeSettingsResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [revision, setRevision] = useState(0)
  const text = useRef(t)
  text.current = t
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const next = await stackPrizeApi.get(gameId)
        if (next.ok !== true) throw new Error('Invalid closure response')
        if (!cancelled) { setData(next); setConfirmation(false); setError('') }
      } catch {
        if (!cancelled) setError(text.current('No se pudo consultar el cierre del juego.', 'Could not load game closure.'))
      }
    }
    void refresh()
    return () => { cancelled = true }
  }, [gameId, revision])
  const close = async () => {
    if (busy) return
    setBusy(true); onSavingChange(true); setError('')
    try {
      const next = await stackPrizeApi.close(gameId)
      if (next.ok !== true) throw new Error('Invalid closure response')
      setData(next)
      setConfirmation(false)
    } catch {
      setError(t('No se pudo confirmar el cierre. Comprueba el estado antes de reintentar.',
        'Could not confirm closure. Check the state before retrying.'))
    } finally { setBusy(false); onSavingChange(false) }
  }
  const action = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-50'
  return <div role="dialog" aria-modal="true" aria-labelledby="stack-close-title" className="fixed inset-0 z-50 flex items-center justify-center p-6">
    <div className="absolute inset-0 bg-black/70" onClick={() => { if (!busy) onBack() }} aria-hidden="true" />
    <div className="relative card w-full max-w-md p-4 max-h-[90vh] overflow-y-auto space-y-4">
      <header className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={onBack} aria-label={t('Volver', 'Back')} className="p-2">←</button>
        <h2 id="stack-close-title" className="text-xl font-semibold flex-1">{t('Cerrar juego', 'Close game')}</h2>
        <OperatorLanguageSelector />
        <IconButton icon="remove" label={t('Cerrar', 'Close')} type="button" disabled={busy} onClick={onClose} />
      </header>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!data && !error && <p role="status">{t('Cargando...', 'Loading...')}</p>}
      {data && <>
        <p role="status" className="text-sm text-textSub">{data.state === 'closed'
          ? t('Partida desactivada. Los premios se conservan; puedes reactivarla desde administración sin reiniciar intentos.', 'Event inactive. Prizes are preserved; reactivate it from administration without resetting attempts.')
          : data.state === 'closing' ? t('Cerrando: las partidas en curso pueden terminar. No se admiten nuevos intentos.', 'Closing: active games may finish. New attempts are blocked.')
            : t('Desactivar bloqueará nuevos intentos y esperará los iniciados antes de adjudicar los premios. Podrás reactivar sin reiniciar resultados ni intentos.',
              'Deactivation blocks new attempts and waits for started attempts before allocating prizes. Reactivation preserves results and consumed attempts.')}</p>
        {data.state === 'closing' && data.pendingPlayers.map((player) => <p key={player.playerId} className="text-sm">{player.name}</p>)}
        {data.state === 'open' && <button type="button" disabled={busy} className={action} onClick={() => setConfirmation(true)}>{t('Desactivar partida', 'Deactivate event')}</button>}
        {confirmation && <div role="alert" className="space-y-3 text-sm">
          <p>{t('Se bloquearán nuevos intentos y se adjudicarán premios al terminar los pendientes. No se celebrarán sorteos automáticamente.',
            'New attempts will be blocked and prizes allocated after pending attempts finish. Raffles will not run automatically.')}</p>
          <button type="button" disabled={busy} className="rounded-xl bg-red-500/20 border border-red-500/30 p-2" onClick={() => void close()}>
            {t('Confirmar desactivación', 'Confirm deactivation')}
          </button>
          <button type="button" disabled={busy} className="ml-3 underline" onClick={() => setConfirmation(false)}>{t('Cancelar', 'Cancel')}</button>
        </div>}
      </>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="text-sm underline" onClick={() => setRevision((value) => value + 1)}>{t('Actualizar estado', 'Refresh status')}</button>
        {onLeave && <button type="button" disabled={busy} className="text-sm underline" onClick={() => { onClose(); onLeave() }}>{t('Salir del juego', 'Leave game')}</button>}
      </div>
    </div>
  </div>
}
