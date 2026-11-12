import { useEffect, useMemo, useRef, useState } from 'react'
import { isStackConfig, type StackConfig, type StackSnapshot } from '../../games/stack/stackLogic'
import { createStackScene, type StackSceneController } from '../../games/stack/stackScene'
import { isRulet4Config, rulet4Segments, type Rulet4Settings } from '../../games/rulet4/rulet4Logic'
import Rulet4Wheel, { type WheelSpin } from '../../games/rulet4/Rulet4Wheel'
import { formatTimer, timerDifference } from '../../games/t1mer/timerLogic'
import { L3trasPlayView } from '../../games/l3tras/ParticipantPlay'
import { PairPlayView } from '../../games/semaforo/ParticipantPlay'
import { InfocardsPlayView } from '../../games/infocards/ParticipantPlay'
import { ImpostorRound } from '../../games/impostor/ParticipantPlay'
import type { ImpostorParticipantState } from '../../api/publicApi'
import { mobileActionClass } from '../participant/useMobilePlay'
import { localPairAnswer, localPairQuestions, useLocalMobilePreview, type PreviewSettings } from './localMobilePreview'
import { getGameForm } from '../../api/gameForms'
import { isFormQuestions, type FormQuestion, type QuizMoment } from '../formConfig'
import { useOperatorLanguage } from '../shell/operatorLanguage'

export type PreviewContent = { questions: FormQuestion[]; quizMoment?: QuizMoment }

const buttonClass = mobileActionClass

export function previewConfigurationError(gameType: string, settings: PreviewSettings, t: (spanish: string, english?: string) => string = spanish => spanish): string | null {
  const integer = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
  switch (gameType) {
    case 'T1MER': case 'SEMAFORO': return null
    case 'STACK': return isStackConfig(settings) ? null : t('Revisa la configuración de STACK antes de probar.', 'Check the STACK settings before playing.')
    case 'RULET4': return isRulet4Config(settings) ? null : t('Revisa los paneles y pesos de RULET4 antes de probar.', 'Check the RULET4 panels and weights before playing.')
    case 'L3TRAS':
      return typeof settings.objectiveWord === 'string' && /^[A-Z]{1,40}$/.test(settings.objectiveWord)
        && (settings.validationTimeLimitSeconds === undefined || integer(settings.validationTimeLimitSeconds, 15, 3600))
        ? null : t('Revisa la palabra (A-Z) y el tiempo de L3TRAS antes de probar.', 'Check the L3TRAS word (A-Z) and time limit before playing.')
    case 'EMPAREJA2':
      return integer(settings.numPairs, 1, 10000)
        && (settings.catalogPairCount == null || (typeof settings.catalogPairCount === 'number' && Number(settings.numPairs) <= settings.catalogPairCount))
        ? null : t('Revisa el número de parejas antes de probar.', 'Check the number of pairs before playing.')
    case 'IMPOSTOR':
      return integer(settings.maxPlayers, 3, 25) && Array.isArray(settings.words) && settings.words.length > 0
        && settings.words.every(word => typeof word === 'string' && word.trim().length > 0)
        ? null : t('Revisa los jugadores y las palabras de IMPOSTOR antes de probar.', 'Check the IMPOSTOR players and words before playing.')
    case 'INFOCARDS':
      return Array.isArray(settings.cards) && settings.cards.length > 0 && settings.cards.every(card =>
        card && typeof card === 'object' && typeof card.id === 'string' && typeof card.title === 'string'
        && card.title.trim() && typeof card.body === 'string')
        ? null : t('Carga o crea tarjetas válidas en el editor antes de probar INFOCARDS.', 'Load or create valid cards in the editor before playing INFOCARDS.')
    case 'CUPIDO': return t('CUPIDO sigue en desarrollo.', 'CUPIDO is still under development.')
    default: return t('Este juego no tiene una prueba disponible.', 'No preview is available for this game.')
  }
}

function TimerPreview() {
  const { t } = useOperatorLanguage()
  const [phase, setPhase] = useState<'idle' | 'running' | 'finished'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(0)
  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => {
      const time = (Date.now() - start.current) / 1000
      setElapsed(time)
      if (time >= 5) window.clearInterval(timer)
    }, 10)
    return () => window.clearInterval(timer)
  }, [phase])
  return <div className="space-y-4 text-center">
    <p>{t('Detén el cronómetro lo más cerca posible de 10 segundos. Se oculta a los 5 s.', 'Stop the timer as close to 10 seconds as possible. It hides at 5 s.')}</p>
    <p role="timer" className="font-digital text-5xl tabular-nums">{phase === 'running' && elapsed >= 5 ? '??:??.?' : formatTimer(elapsed)}</p>
    {phase === 'idle' && <button className={buttonClass} onClick={() => {
      start.current = Date.now()
      setPhase('running')
    }}>{t('Empezar', 'Start')}</button>}
    {phase === 'running' && <button className={buttonClass} onClick={() => {
      setElapsed((Date.now() - start.current) / 1000)
      setPhase('finished')
    }}>{t('Detener', 'Stop')}</button>}
    {phase === 'finished' && <p role="status">{t('Resultado simulado:', 'Simulated result:')} {elapsed.toFixed(3)} s · {t('Diferencia:', 'Difference:')} {timerDifference(elapsed).toFixed(3)} s</p>}
  </div>
}

function StackPreview({ config }: { config: StackConfig }) {
  const { t } = useOperatorLanguage()
  const canvas = useRef<HTMLCanvasElement>(null)
  const controller = useRef<StackSceneController | null>(null)
  const [snapshot, setSnapshot] = useState<StackSnapshot>({ state: 'IDLE', score: 0, perfect: false, placements: [] })
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!canvas.current) return
    let active = true
    let scene: StackSceneController | undefined
    try {
      scene = createStackScene(canvas.current, {
        config,
        onUpdate: value => { if (active) setSnapshot(value) },
        onPauseChange: value => { if (active) setPaused(value) },
        onContextLost: () => { if (active) setError('Se ha perdido WebGL. Reinicia la prueba para recuperarlo.') },
        onContextRestored: () => { if (active) setError('') },
        onError: () => { if (active) setError('No se pudo mostrar STACK. Este juego necesita WebGL 2.') },
      })
      controller.current = scene
      setReady(true)
    } catch {
      setError('No se pudo mostrar STACK. Este juego necesita WebGL 2.')
    }
    return () => {
      active = false
      controller.current = null
      scene?.dispose()
    }
  }, [config])
  return <div className="space-y-3">
    <p>{t('Bloques:', 'Blocks:')} {snapshot.score}</p>
    <canvas ref={canvas} className="h-72 w-full" aria-label="STACK 3D de prueba" />
    {error && <p role="alert">{t(error, 'STACK could not be displayed. This game requires WebGL 2. Reset the preview to retry.')}</p>}
    {paused && !error && <p role="status">{t('Prueba pausada. Vuelve a esta ventana para jugar.', 'Preview paused. Return to this window to play.')}</p>}
    {snapshot.state === 'GAME_OVER' ? <p role="status">{t('Resultado simulado:', 'Simulated result:')} {snapshot.score} {t('bloques', 'blocks')}</p>
      : <button className={buttonClass} disabled={!ready || !!error || paused || snapshot.state === 'PLACING'} onClick={() => {
        if (snapshot.state === 'IDLE') controller.current?.start()
        else controller.current?.place()
      }}>{snapshot.state === 'IDLE' ? t('Empezar', 'Start') : t('Colocar', 'Place')}</button>}
  </div>
}

function RoulettePreview({ config }: { config: Rulet4Settings }) {
  const { t } = useOperatorLanguage()
  const segments = useMemo(() => rulet4Segments(config), [config])
  const [ready, setReady] = useState(false)
  const [spin, setSpin] = useState<WheelSpin | null>(null)
  const [completed, setCompleted] = useState(false)
  return <div className="space-y-4 text-center">
    <div className="h-72"><Rulet4Wheel segments={segments} spin={spin} completed={completed} dimmed={false}
      onReadyChange={setReady} onComplete={() => setCompleted(true)} /></div>
    <p className="text-sm">{config.panels.map(panel => `${panel.label} (${panel.count})`).join(' · ')}</p>
    {!completed && <button className={buttonClass} disabled={!ready || !!spin}
      onClick={() => setSpin({ id: 1, index: Math.floor(Math.random() * segments.length) })}>{spin ? t('Girando…', 'Spinning…') : t('Girar ruleta', 'Spin wheel')}</button>}
    {completed && spin && <p role="status">{t('Resultado simulado:', 'Simulated result:')} {segments[spin.index].label}. {t('No se reserva ni entrega ningún premio.', 'No prize is reserved or delivered.')}</p>}
  </div>
}

function MobilePreview({ gameType, settings }: { gameType: 'L3TRAS' | 'SEMAFORO' | 'INFOCARDS'; settings: PreviewSettings }) {
  const { t } = useOperatorLanguage()
  const runtime = useLocalMobilePreview(gameType, settings)
  return <div className="space-y-4">
    {gameType === 'L3TRAS' && <>
      <details open><summary>{t('Jugadores simulados', 'Simulated players')}</summary>
        <ul className="flex flex-wrap gap-3 text-sm">{Array.from(String(settings.objectiveWord), (letter, index) =>
          <li key={index}>{index === 0 ? t('Tú', 'You') : `${t('Jugador', 'Player')} ${index + 1}`}: {letter} · {1000 + index}</li>)}</ul>
      </details>
      <L3trasPlayView runtime={runtime} />
    </>}
    {gameType === 'SEMAFORO' && <>
      <p className="text-sm">{t('Sam es tu pareja local: código 1001. 5 s por pregunta y máximo 3 fallos. Las respuestas de ambos jugadores son simuladas.', 'Sam is your local partner: code 1001. 5 s per question and at most 3 mistakes. Both players’ answers are simulated.')}</p>
      <details><summary>{t('Respuestas de los jugadores simulados', 'Simulated player answers')}</summary>
        <ul>{localPairQuestions(settings).map(question => <li key={question.id}>{question.text}: Sam → {localPairAnswer(question, 0).title}; Alex → {localPairAnswer(question, 1).title}</li>)}</ul>
      </details>
      <PairPlayView runtime={runtime} />
    </>}
    {gameType === 'INFOCARDS' && <InfocardsPlayView runtime={runtime} />}
  </div>
}

function SemaforoPreview({ settings, gameId, content }: { settings: PreviewSettings; gameId?: string; content?: PreviewContent }) {
  const { t } = useOperatorLanguage()
  const [remote, setRemote] = useState<PreviewContent | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (content || !gameId) return
    let active = true
    setRemote(null)
    setError('')
    void getGameForm(gameId).then(form => {
      if (active) setRemote({ questions: form.questions, quizMoment: form.formConfig.quizMoment })
    }).catch(() => {
      if (active) setError('No se pudo cargar el cuestionario de SEMAFORO. Reintenta la carga.')
    })
    return () => { active = false }
  }, [gameId, content, retry])
  const configured = content ?? remote
  if (gameId && !configured) return <div className="space-y-3">
    {error ? <><p role="alert">{t(error, 'Could not load the SEMAFORO questionnaire. Retry loading.')}</p><button className={buttonClass} onClick={() => setRetry(value => value + 1)}>{t('Reintentar carga', 'Retry loading')}</button></>
      : <p role="status">{t('Cargando cuestionario de SEMAFORO…', 'Loading the SEMAFORO questionnaire…')}</p>}
  </div>
  if (configured && !isFormQuestions(configured.questions)) return <p role="alert">{t('Revisa las preguntas de SEMAFORO antes de probar.', 'Check the SEMAFORO questions before playing.')}</p>
  return <div className="space-y-3">
    {!configured && <p className="text-sm">{t('Cuestionario de ejemplo: no se ha proporcionado el contenido de una partida.', 'Sample questionnaire: no game content was provided.')}</p>}
    {configured && configured.quizMoment !== undefined && configured.quizMoment !== 'after_registration' && <p className="text-sm">{t('La pareja se valida sin quiz cruzado porque el cuestionario no se completa antes del juego.', 'The pair is validated without a cross-quiz because the questionnaire is not completed before playing.')}</p>}
    <MobilePreview key={JSON.stringify(configured)} gameType="SEMAFORO" settings={{ ...settings, ...configured }} />
  </div>
}

function PairPreview({ settings }: { settings: PreviewSettings }) {
  const { t } = useOperatorLanguage()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(false)
  const [error, setError] = useState('')
  const count = Number(settings.numPairs)
  return <div className="space-y-4 text-center">
    <p>{t('Te toca:', 'Your character:')} <strong>{t('Sol', 'Sun')}</strong> · {t('Tu código:', 'Your code:')} 1000</p>
    <p>{t('Tu misión: encuentra a', 'Your mission: find')} <strong>{t('Luna', 'Moon')}</strong></p>
    <p className="text-sm">{count} {t('parejas simuladas. Luna: código 1001.', 'simulated pairs. Moon: code 1001.')}{count > 1 ? t(' Otro personaje (sin pareja contigo): 1002.', ' Another character (not your partner): 1002.') : ''} {t('Los personajes de esta prueba son de ejemplo.', 'This preview uses sample characters.')}</p>
    {result ? <p role="status">{t('¡Pareja validada! Resultado simulado, sin premio real.', 'Pair validated! Simulated result, no real prize.')}</p> : <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      if (code === '1001') { setResult(true); setError('') }
      else setError(code === '1000' ? t('Introduce el código de otra persona.', 'Enter another person’s code.') : t('Ese código no es el de tu pareja simulada.', 'That is not your simulated partner’s code.'))
    }}>
      <label className="block" htmlFor="preview-pair-code">{t('Código de tu pareja', 'Partner code')}</label>
      <input id="preview-pair-code" className="w-full rounded-xl border border-primary/30 bg-transparent p-3" value={code}
        inputMode="numeric" pattern="[0-9]{4}" maxLength={4} onChange={event => setCode(event.target.value)} />
      <button className={buttonClass} disabled={code.length !== 4}>{t('Validar pareja', 'Validate pair')}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </div>
}

function ImpostorPreview({ settings }: { settings: PreviewSettings }) {
  const { t } = useOperatorLanguage()
  const [phase, setPhase] = useState<ImpostorParticipantState['phase']>('lobby')
  const [turn, setTurn] = useState(0)
  const [role, setRole] = useState<'crew' | 'impostor'>('crew')
  const [winner, setWinner] = useState<'crew' | 'impostor'>('crew')
  const words = settings.words as string[]
  const [word] = useState(() => words[Math.floor(Math.random() * words.length)])
  const count = Number(settings.maxPlayers)
  const state: ImpostorParticipantState = {
    phase, round: 1, inRound: true, role, word: role === 'crew' ? word : null,
    currentTurn: phase === 'word_round' ? { isMine: turn === 0, name: turn === 0 ? 'Alex' : `${t('Jugador', 'Player')} ${turn + 1} ${t('(simulado)', '(simulated)')}` } : null,
    winner: phase === 'result' ? winner : null, won: phase === 'result' ? winner === role : null,
  }
  return <div className="space-y-4">
    <p>{count} {t('jugadores locales; el resto se simula. No hay moderación ni votación real.', 'local players; the others are simulated. No real moderation or voting.')}</p>
    {phase === 'lobby' && <label className="block">{t('Tu papel', 'Your role')}
      <select className="ml-3 rounded border border-primary/30 bg-surface p-2" value={role} onChange={event => setRole(event.target.value as typeof role)}>
        <option value="crew">{t('Jugador', 'Player')}</option><option value="impostor">{t('Impostor', 'Impostor')}</option>
      </select>
    </label>}
    <ImpostorRound state={state} />
    {phase === 'lobby' && <button className={buttonClass} onClick={() => setPhase('word_round')}>{t('Empezar ronda', 'Start round')}</button>}
    {phase === 'word_round' && <button className={buttonClass} onClick={() => {
      if (turn + 1 >= count) setPhase('voting')
      else setTurn(turn + 1)
    }}>{turn === 0 ? t('He dicho mi palabra', 'I said my word') : t('Simular siguiente jugador', 'Simulate next player')}</button>}
    {phase === 'voting' && <div className="space-y-3">
      <p>{t('Voto local (los demás jugadores votan automáticamente):', 'Local vote (the other players vote automatically):')}</p>
      <button className={buttonClass} onClick={() => { setWinner('crew'); setPhase('result') }}>{t('Señalar al impostor', 'Vote for the impostor')}</button>
      <button className={buttonClass} onClick={() => { setWinner('impostor'); setPhase('result') }}>{t('Señalar a otro jugador', 'Vote for another player')}</button>
    </div>}
    {phase === 'result' && <p role="status">{t('Resultado simulado. Palabra de la ronda:', 'Simulated result. Round word:')} {word}</p>}
  </div>
}

export default function PlayableGamePreview({ gameType, settings, gameId, content }: {
  gameType: string; settings: PreviewSettings; gameId?: string; content?: PreviewContent
}) {
  switch (gameType) {
    case 'T1MER': return <TimerPreview />
    case 'STACK': return <StackPreview config={settings as StackConfig} />
    case 'RULET4': return <RoulettePreview config={settings as Rulet4Settings} />
    case 'L3TRAS': case 'INFOCARDS': return <MobilePreview gameType={gameType} settings={settings} />
    case 'SEMAFORO': return <SemaforoPreview settings={settings} gameId={gameId} content={content} />
    case 'EMPAREJA2': return <PairPreview settings={settings} />
    case 'IMPOSTOR': return <ImpostorPreview settings={settings} />
    default: return null
  }
}
