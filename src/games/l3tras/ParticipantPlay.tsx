import { useState } from 'react'
import { mobileActionClass, useMobilePlay, useRemaining, type MobilePlayProps } from '../../core/participant/useMobilePlay'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

export default function L3trasParticipantPlay(props: MobilePlayProps) {
  const runtime = useMobilePlay(props)
  return <L3trasPlayView runtime={runtime} />
}

export function L3trasPlayView({ runtime }: { runtime: ReturnType<typeof useMobilePlay> }) {
  const { t } = useParticipantLanguage()
  const { assignment, busy, error, loaded, send, refresh, pending } = runtime
  const [code, setCode] = useState(String(assignment.validationCode ?? ''))
  const state = assignment.play
  const remaining = useRemaining(state.expiresAt, state.serverNow)
  const finished = state.phase === 'finished' || assignment.validated
  const expired = state.phase === 'expired' || (state.phase === 'collecting' && remaining === 0)
  return <section className="space-y-5 text-center" aria-label="L3TRAS">
    <h1 className="text-2xl font-bold">L3TRAS</h1>
    <p>{t('Tu letra')}: <strong className="text-3xl text-primary">{assignment.letter}</strong></p>
    <p>{t('Tu código')}: <strong className="font-mono tracking-widest">{assignment.validationCode}</strong></p>
    <p className="text-sm text-textSub">{t('Reúne los códigos de tu grupo en este móvil para formar la palabra. Incluye tu código.')}</p>
    <p className="break-all text-2xl font-bold tracking-widest text-accent">{state.word}</p>
    <div className="flex flex-wrap justify-center gap-2" aria-label={t('Letras reunidas')}>
      {state.slots?.map((letter, index) => <span key={index}
        className="flex h-12 w-10 items-center justify-center rounded-lg border border-primary/40 text-xl font-bold">
        {expired ? '—' : letter ?? '—'}
      </span>)}
    </div>
    {state.phase === 'collecting' && !finished && <p role="timer" className="font-digital text-3xl">{remaining}s</p>}
    {finished ? <p role="status" className="font-bold text-accent">{t('¡Palabra completada!')}</p> : <>
      {expired && <p role="status">{t('Se acabó el tiempo. Volved a reunir las letras.')}</p>}
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault()
        void send({ move: 'code', code }).then(ok => { if (ok) setCode('') })
      }}>
        <label className="block text-left text-sm" htmlFor="letter-code">{t('Código de participante')}</label>
        <input id="letter-code" className="w-full rounded-xl border border-primary/30 bg-transparent p-3 text-center text-xl"
          inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={code}
          disabled={busy || pending} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className={mobileActionClass} disabled={busy || !loaded || (!pending && code.length !== 4)}>
          {t(busy ? 'Comprobando…' : pending ? 'Reintentar acción' : 'Añadir letra')}
        </button>
      </form>
      {state.phase !== 'idle' && <button className="min-h-12 underline" disabled={busy || pending}
        onClick={() => void send({ move: 'reset' })}>{t('Volver a empezar')}</button>}
    </>}
    {!loaded && !busy && <button className={mobileActionClass} onClick={() => void refresh()}>{t('Reintentar carga')}</button>}
    {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
  </section>
}
