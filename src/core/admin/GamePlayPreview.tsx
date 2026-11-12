import { useOperatorLanguage } from '../shell/operatorLanguage'
import { useEffect, useRef, useState } from 'react'
import { normalizeGameType } from '../gameTypeMap'
import PlayableGamePreview, { previewConfigurationError, type PreviewContent } from './PlayableGamePreview'
import { ParticipantLanguageProvider } from '../participant/participantLanguage'

export type GamePlayPreviewProps = {
  gameType: string
  /** Omit for the inert Home illustration; pass the editor draft to enable an isolated local game. */
  settings?: Record<string, unknown>
  /** Only SEMAFORO uses this ID, to read its saved questionnaire when content is not supplied. */
  gameId?: string
  content?: PreviewContent
}

export default function GamePlayPreview({ gameType, settings, gameId, content }: GamePlayPreviewProps) {
  const { language, t } = useOperatorLanguage()
  const [reset, setReset] = useState(0)
  const [hidden, setHidden] = useState(document.hidden)
  const signature = JSON.stringify(settings)
  const mechanics = useRef({ signature, settings })
  if (mechanics.current.signature !== signature) mechanics.current = { signature, settings }
  const previous = useRef(signature)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (previous.current !== signature) {
      setChanged(true)
      previous.current = signature
    }
  }, [signature])
  useEffect(() => {
    const visibility = () => setHidden(document.hidden)
    const leave = () => setHidden(true)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', visibility)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', visibility)
    }
  }, [])
  if (settings === undefined) return <StaticGamePlayPreview gameType={gameType} />
  const type = normalizeGameType(gameType)
  const error = previewConfigurationError(type, settings, t)
  return <section className="space-y-4" aria-label={t('Prueba jugable aislada', 'Isolated playable preview')}>
    <p className="text-sm text-textSub">{t('Simulación local: no registra participantes, resultados ni premios y no contacta con el club.', 'Local simulation: no participants, results or prizes are registered and the club is not contacted.')}</p>
    {changed && <p role="status">{t('La configuración ha cambiado. La prueba se ha reiniciado con el borrador.', 'Settings changed. The preview restarted with the draft.')}</p>}
    <button type="button" className="min-h-11 rounded-lg border border-primary/30 px-4 py-2" onClick={() => {
      setReset(value => value + 1)
      setChanged(false)
    }}>{t('Reiniciar prueba', 'Reset preview')}</button>
    {error ? <p role="alert">{error}</p> : hidden ? <p role="status">{t('Prueba detenida al salir de esta pestaña. Se reiniciará al volver.', 'Preview stopped when leaving this tab. It will restart on return.')}</p>
      : <ParticipantLanguageProvider key={language} initialLanguage={language}>
        <PlayableGamePreview key={`${type}:${gameId ?? ''}:${signature}:${reset}`} gameType={type} settings={mechanics.current.settings!}
          gameId={gameId} content={content} />
      </ParticipantLanguageProvider>}
  </section>
}

function StaticGamePlayPreview({ gameType }: { gameType: string }) {
  const { t } = useOperatorLanguage()
  const actionClass = 'w-full rounded-xl border border-primary/40 bg-primary/20 py-3 font-bold text-primary disabled:opacity-100'
  switch (gameType.toUpperCase()) {
    case 'L3TRAS':
      return <div className="space-y-5 text-center">
        <h2 className="text-xl font-bold">L3TRAS</h2>
        <p>{t('Tu letra', 'Your letter')}: <strong className="text-3xl text-primary">S</strong></p>
        <p className="text-3xl tracking-widest text-accent">S T — — —</p>
        <p className="font-digital text-3xl">01:45</p>
        <p className="text-sm text-textSub">{t('Reúne los códigos de tu grupo en este móvil.', 'Collect your group’s codes on this phone.')}</p>
        <button disabled className={actionClass}>{t('Añadir letra', 'Add letter')}</button>
      </div>
    case 'SEMAFORO':
    case 'CUPIDO':
      return <div className="space-y-5 text-center">
        <h2 className="text-xl font-bold">{gameType.toUpperCase()}</h2>
        {gameType.toUpperCase() === 'CUPIDO' && <p>{t('En desarrollo', 'Under development')}</p>}
        <p>{t('Tu código', 'Your code')}: <strong className="font-mono text-3xl text-primary">1234</strong></p>
        <div className="rounded-xl border border-primary/30 p-4">{t('Código de tu pareja', 'Your partner’s code')}: 5678</div>
        <button disabled className={actionClass}>{t('Validar pareja', 'Validate pair')}</button>
        {gameType.toUpperCase() === 'SEMAFORO' && <p className="text-sm text-textSub">{t('Quiz cruzado por turnos en un móvil: 5 segundos por pregunta, máximo 3 fallos.', 'Take turns on one phone: 5 seconds per question, up to 3 mistakes.')}</p>}
      </div>
    case 'INFOCARDS':
      return <div className="space-y-5">
        <article className="space-y-3 rounded-xl border border-primary/30 p-6">
          <h2 className="text-xl font-bold">{t('Bienvenido al evento', 'Welcome to the event')}</h2>
          <p className="text-textSub">{t('Desliza las tarjetas para descubrir las actividades.', 'Swipe the cards to discover the activities.')}</p>
        </article>
        <p className="text-center text-sm">1 / 3</p>
        <button disabled className={actionClass}>{t('Siguiente', 'Next')}</button>
      </div>
    case 'T1MER':
      return <div className="space-y-6 text-center">
        <p className="text-sm text-textSub">{t('Jugando como', 'Playing as')} Alex</p>
        <p className="py-6 font-digital text-5xl font-bold tabular-nums">00:00.0</p>
        <p className="text-sm text-textSub">{t('Detén el cronómetro lo más cerca posible de 10 segundos.', 'Stop the timer as close to 10 seconds as possible.')}</p>
        <button type="button" disabled className={actionClass}>{t('EMPEZAR', 'START')}</button>
      </div>
    case 'STACK':
      return <div className="space-y-4">
        <p className="font-bold">{t('Bloques:', 'Blocks:')} <span className="text-accent">8</span></p>
        <div className="flex h-56 flex-col items-center justify-end gap-1 rounded-xl border border-primary/20 bg-primary/5 p-5"
          role="img" aria-label={t('Ejemplo de bloques apilados', 'Sample stacked blocks')}>
          {[40, 48, 56, 64, 72].map(width => <div key={width} className="h-7 rounded bg-primary"
            style={{ width: `${width}%` }} />)}
        </div>
        <p className="text-center text-sm text-textSub">{t('Toca para apilar', 'Tap to stack')}</p>
        <button type="button" disabled className={actionClass}>{t('COLOCAR', 'PLACE')}</button>
      </div>
    case 'RULET4':
      return <div className="space-y-5 text-center">
        <h2 className="text-xl font-bold">RULET4</h2>
        <div className="relative mx-auto h-56 w-56 rounded-full border-8 border-primary" role="img"
          aria-label={t('Ejemplo de ruleta', 'Sample wheel')}
          style={{ background: 'conic-gradient(var(--color-primary) 0deg 90deg, var(--color-accent) 90deg 180deg, var(--color-primary) 180deg 270deg, var(--color-accent) 270deg)' }}>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-[var(--color-background)] p-5 text-2xl">▼</span>
          </span>
        </div>
        <button type="button" disabled className={actionClass}>{t('GIRAR', 'SPIN')}</button>
      </div>
    case 'EMPAREJA2':
      return <div className="space-y-5 text-center">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-8">
          <p className="text-sm text-textSub">{t('Te toca', 'Your character')}</p>
          <p className="py-5 text-4xl font-bold text-primary">{t('Sol', 'Sun')}</p>
        </div>
        <p className="font-semibold text-accent">{t('Tu misión: encuentra a Luna', 'Your mission: find Moon')}</p>
        <button type="button" disabled className={actionClass}>{t('Validar pareja', 'Validate pair')}</button>
      </div>
    case 'IMPOSTOR':
      return <div className="space-y-6 text-center">
        <p className="text-sm text-textSub">{t('Tu código', 'Your code')}</p>
        <p className="text-4xl font-bold tracking-widest text-primary">1234</p>
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6">
          <p className="text-sm text-textSub">{t('Tu palabra', 'Your word')}</p>
          <p className="mt-3 text-2xl font-bold text-accent">{t('Playa', 'Beach')}</p>
        </div>
        <p className="text-sm text-textSub">{t('No enseñes tu pantalla a los demás jugadores.', 'Do not show your screen to other players.')}</p>
      </div>
    default:
      return <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">{t('¡Ya estás dentro!', 'You are in!')}</h2>
        <p className="text-sm text-textSub">{t('Sigue las instrucciones del evento para jugar.', 'Follow the event instructions to play.')}</p>
      </div>
  }
}
