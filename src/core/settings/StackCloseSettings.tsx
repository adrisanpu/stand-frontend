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
  const [confirmation, setConfirmation] = useState<'close' | 'exclude' | null>(null)
  const [revision, setRevision] = useState(0)
  const text = useRef(t)
  text.current = t
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const next = await stackPrizeApi.get(gameId)
        if (next.ok !== true) throw new Error('Invalid closure response')
        if (!cancelled) { setData(next); setConfirmation(null); setError('') }
      } catch {
        if (!cancelled) setError(text.current('No se pudo consultar el cierre del juego.', 'Could not load game closure.'))
      }
    }
    void refresh()
    return () => { cancelled = true }
  }, [gameId, revision])
  const close = async (exclude: boolean) => {
    if (busy) return
    setBusy(true); onSavingChange(true); setError('')
    try {
      const next = await stackPrizeApi.close(gameId, exclude ? data?.pendingPlayers.map((player) => player.playerId) : [])
      if (next.ok !== true) throw new Error('Invalid closure response')
      setData(next)
      setConfirmation(null)
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
        <button type="button" disabled={busy} onClick={onClose} aria-label={t('Cerrar', 'Close')} className="p-2">×</button>
      </header>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!data && !error && <p role="status">{t('Cargando...', 'Loading...')}</p>}
      {data && <>
        <p role="status" className="text-sm text-textSub">{data.state === 'closed'
          ? t('Juego cerrado. El ranking es definitivo y los premios se conservan.', 'Game closed. The ranking is final and prizes are preserved.')
          : data.state === 'closing' ? t('Cerrando: las partidas en curso pueden terminar. No se admiten nuevos intentos.', 'Closing: active games may finish. New attempts are blocked.')
            : t('El cierre es definitivo. Las partidas en curso podrán terminar antes de fijar el ranking y entregar los premios finales.',
              'Closure is final. Active games may finish before the ranking is finalized and final prizes are awarded.')}</p>
        {data.state === 'closing' && data.pendingPlayers.map((player) => <p key={player.playerId} className="text-sm">{player.name}</p>)}
        {data.state === 'open' && <button type="button" disabled={busy} className={action} onClick={() => setConfirmation('close')}>{t('Cerrar juego', 'Close game')}</button>}
        {data.state === 'closing' && <button type="button" disabled={busy} className={action} onClick={() => void close(false)}>{t('Comprobar y finalizar cierre', 'Check and finish closure')}</button>}
        {data.state === 'closing' && data.pendingPlayers.length > 0 && <button type="button" disabled={busy} className="block text-sm text-amber-300 underline" onClick={() => setConfirmation('exclude')}>
          {t('Excluir los intentos pendientes', 'Exclude pending attempts')}
        </button>}
        {confirmation && <div role="alert" className="space-y-3 text-sm">
          <p>{confirmation === 'exclude'
            ? t('Los intentos pendientes mostrados se excluirán sin puntuación ni premios. Sus resultados tardíos serán rechazados.',
              'The pending attempts shown will be excluded without scores or prizes. Late results will be rejected.')
            : t('Se bloquearán nuevos intentos. Al terminar los pendientes, el ranking será definitivo. Esta acción no se puede deshacer.',
              'New attempts will be blocked. Once pending games finish, the ranking becomes final. This cannot be undone.')}</p>
          <button type="button" disabled={busy} className="rounded-xl bg-red-500/20 border border-red-500/30 p-2" onClick={() => void close(confirmation === 'exclude')}>
            {confirmation === 'exclude' ? t('Confirmar exclusión y cierre', 'Confirm exclusion and close') : t('Confirmar cierre', 'Confirm closure')}
          </button>
          <button type="button" disabled={busy} className="ml-3 underline" onClick={() => setConfirmation(null)}>{t('Cancelar', 'Cancel')}</button>
        </div>}
      </>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="text-sm underline" onClick={() => setRevision((value) => value + 1)}>{t('Actualizar estado', 'Refresh status')}</button>
        {onLeave && <button type="button" disabled={busy} className="text-sm underline" onClick={() => { onClose(); onLeave() }}>{t('Salir del juego', 'Leave game')}</button>}
      </div>
    </div>
  </div>
}
