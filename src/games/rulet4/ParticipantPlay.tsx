import { useMemo, useRef, useState, useEffect } from 'react'
import { publicApi } from '../../api/publicApi'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import Rulet4Wheel, { type WheelSpin } from './Rulet4Wheel'
import { isRulet4Config, rulet4Segments, type Rulet4Assignment, type Rulet4Settings, type Rulet4Result } from './rulet4Logic'

type Props = {
  gameId: string
  playerToken: string
  config?: Rulet4Settings
  assignment: Rulet4Assignment
}

export default function Rulet4ParticipantPlay({ gameId, playerToken, config, assignment }: Props) {
  const { t, language } = useParticipantLanguage()
  const [result, setResult] = useState<Rulet4Result | null>(assignment.result)
  const [completed, setCompleted] = useState(assignment.result !== null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const request = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const settings = result?.configSnapshot ?? config
  const segments = useMemo(() => isRulet4Config(settings) ? rulet4Segments(settings) : [], [settings])
  const spin: WheelSpin | null = useMemo(() => result ? { id: 1, index: result.index } : null, [result])
  const play = async () => {
    if (request.current || result || !ready) return
    request.current = true
    setBusy(true)
    setError(false)
    try {
      const next = await publicApi.spinRulet4(gameId, playerToken)
      if (active.current) setResult(next)
    } catch {
      if (active.current) setError(true)
    } finally {
      request.current = false
      if (active.current) setBusy(false)
    }
  }
  if (!segments.length) return <p role="alert">{t('No se pudo cargar la ruleta. Recarga la página.')}</p>
  return (
    <section className="space-y-4 text-center">
      <h1 className="text-xl font-bold">RULET4</h1>
      <p>{assignment.displayName}</p>
      <div className="aspect-square w-full">
        <Rulet4Wheel segments={segments} spin={spin} completed={completed} dimmed={false} language={language}
          onReadyChange={setReady} onComplete={() => setCompleted(true)} />
      </div>
      {error && <p role="alert">{t('No se pudo confirmar el giro. Reintenta para recuperar el mismo resultado.')}</p>}
      {completed && result ? (
        <div role="status"><p>{t('Tu resultado')}</p><p className="text-2xl font-bold">{result.panel.label}</p></div>
      ) : (
        <button type="button" onClick={() => void play()} disabled={!ready || busy || result !== null}
          className="w-full rounded-xl border border-primary/30 bg-primary/20 py-3 font-bold disabled:opacity-50">
          {t(busy || result ? 'Girando...' : 'Girar ruleta')}
        </button>
      )}
    </section>
  )
}
