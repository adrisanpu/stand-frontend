import { useEffect, useRef, useState } from 'react'
import { mobileActionClass, useMobilePlay, useRemaining, type MobilePlayProps } from '../../core/participant/useMobilePlay'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

export function PairParticipantPlay(props: MobilePlayProps) {
  const runtime = useMobilePlay(props)
  return <PairPlayView runtime={runtime} />
}

export function PairPlayView({ runtime }: { runtime: ReturnType<typeof useMobilePlay> }) {
  const { t } = useParticipantLanguage()
  const { assignment, busy, error, loaded, send, refresh, pending } = runtime
  const [code, setCode] = useState('')
  const state = assignment.play
  const remaining = useRemaining(state.expiresAt, state.serverNow)
  const timedOut = useRef<number | null>(null)
  const finished = state.phase === 'finished' || (assignment.validated && state.phase !== 'quiz')
  useEffect(() => {
    if (!loaded || state.phase !== 'quiz' || !state.turn?.ready || remaining > 0 || busy || error
      || timedOut.current === state.revision) return
    timedOut.current = state.revision
    void send({ move: 'answer', answer: null })
  }, [state, remaining, busy, error, loaded, send])
  return <section className="space-y-5 text-center" aria-label={assignment.gameType}>
    <h1 className="text-2xl font-bold">{assignment.gameType}</h1>
    {assignment.gameType === 'CUPIDO' && <p className="text-sm text-textSub">{t('En desarrollo')}</p>}
    <p>{t('Tu código')}: <strong className="font-mono text-2xl tracking-widest text-primary">{assignment.validationCode}</strong></p>
    {assignment.statusLabel && <p className="rounded-xl border border-primary/30 p-3 font-semibold">{assignment.statusLabel}</p>}
    {state.participants && <p>{state.participants.join(' & ')}</p>}
    {state.phase === 'quiz' ? <>
      <p className="text-sm">{t('Fallos')}: {state.strikes ?? 0}/3</p>
      {state.lastCorrect !== undefined && <p role="status">{t(state.lastCorrect ? '¡Correcto!' : 'Respuesta incorrecta o fuera de tiempo.')}</p>}
      <h2 className="text-lg font-semibold">{t('Turno de')} {state.turn?.guesser}</h2>
      <p>{t('Adivina la respuesta de')} {state.turn?.target}</p>
      {state.turn?.ready ? <>
        <p role="timer" className="font-digital text-3xl">{remaining}s</p>
        <h3 className="font-bold">{state.turn.question?.text}</h3>
        <div className="space-y-3">
          {state.turn.question?.options.map(option => <button key={option.payload} className={mobileActionClass}
            disabled={busy || remaining === 0 || pending}
            onClick={() => void send({ move: 'answer', answer: option.payload })}>{option.title}</button>)}
        </div>
      </> : <button className={mobileActionClass} disabled={busy || !loaded}
        onClick={() => void send({ move: 'ready' })}>{t('Estoy listo: empezar turno')}</button>}
    </> : finished ? <p role="status" className="font-bold text-accent">
      {t(state.result === 'lost' ? 'Habéis llegado a tres fallos. Quiz terminado.' : '¡Pareja validada!')}
    </p> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void send({ move: 'pair', code }) }}>
      <p className="text-sm text-textSub">{t('Introduce el código de tu pareja. Jugaréis por turnos en este móvil.')}</p>
      <label className="block text-left text-sm" htmlFor="partner-code">{t('Código de tu pareja')}</label>
      <input id="partner-code" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4}
        className="w-full rounded-xl border border-primary/30 bg-transparent p-3 text-center text-xl"
        value={code} disabled={busy || pending} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} />
      <button className={mobileActionClass} disabled={busy || !loaded || pending || code.length !== 4}>{t(busy ? 'Comprobando…' : 'Validar pareja')}</button>
    </form>}
    {pending && !busy && <button className={mobileActionClass} onClick={() => void send({ move: 'ready' })}>{t('Reintentar acción')}</button>}
    {!loaded && !busy && <button className={mobileActionClass} onClick={() => void refresh()}>{t('Reintentar carga')}</button>}
    {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
  </section>
}

export default PairParticipantPlay
