import { useLayoutEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import GamePlayPreview from '../core/admin/GamePlayPreview'
import { OperatorLanguageProvider } from '../core/shell/operatorLanguage'
import { ThemeProvider } from '../core/theme'
import { getGameById } from '../games'
import { DEFAULT_STACK_CONFIG } from '../games/stack/stackLogic'

const DEMOS: Record<string, Record<string, unknown> | undefined> = {
  RULET4: {
    panels: [
      { id: 'sun', label: 'Experiencia extra', color: '#F59E0B', count: 2 },
      { id: 'star', label: 'Sigue jugando', color: '#7C3AED', count: 3 },
      { id: 'spark', label: '¡Buen intento!', color: '#0EA5E9', count: 1 },
    ],
  },
  T1MER: {},
  STACK: { ...DEFAULT_STACK_CONFIG },
  BASKET: {},
  L3TRAS: { objectiveWord: 'STAND', validationTimeLimitSeconds: 60 },
  INFOCARDS: {
    cards: [
      { id: 'welcome', title: '¡Bienvenido!', body: 'Descubre una experiencia creada para este evento.' },
      { id: 'activity', title: 'Participa', body: 'Prueba las actividades y conoce todo lo que ocurre en el espacio.' },
      { id: 'brand', title: 'Conecta', body: 'Comparte el momento y sigue explorando.' },
    ],
  },
  EMPAREJA2: { numPairs: 3 },
  CUPIDO: undefined,
  SEMAFORO: {
    quizMoment: 'after_registration',
    questions: [
      { id: 'demo-1', text: '¿Qué plan prefieres?', options: [{ title: 'Playa', payload: 'beach' }, { title: 'Montaña', payload: 'mountain' }] },
      { id: 'demo-2', text: '¿Mañana o noche?', options: [{ title: 'Mañana', payload: 'morning' }, { title: 'Noche', payload: 'night' }] },
    ],
  },
}

export default function GamePreviewPage() {
  const { gameType = '' } = useParams()
  const [params] = useSearchParams()
  const type = gameType.toUpperCase()
  const language = params.get('lang') === 'en' ? 'en' : 'es'
  const supported = Object.prototype.hasOwnProperty.call(DEMOS, type)
  const game = supported ? getGameById(type) ?? null : null
  const settings = supported ? DEMOS[type] : undefined
  const viewportRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const fit = () => {
      const availableHeight = Math.max(1, viewport.clientHeight - 16)
      setScale(Math.min(1, availableHeight / Math.max(1, content.offsetHeight)))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(viewport)
    observer.observe(content)
    fit()
    return () => observer.disconnect()
  }, [])

  return (
    <OperatorLanguageProvider key={language} initialLanguage={language}>
      <ThemeProvider game={game}>
        <main ref={viewportRef} className="relative h-dvh overflow-hidden bg-[var(--color-background)] text-textMain">
          <div ref={contentRef} className="absolute left-1/2 top-1/2 w-[calc(100%-1rem)] max-w-xl"
            style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
            {!supported
              ? <p role="alert">{language === 'en' ? 'This game preview is not available.' : 'La vista previa de este juego no está disponible.'}</p>
              : <GamePlayPreview gameType={type} settings={settings} showReset={params.get('embedded') !== '1'} />}
          </div>
        </main>
      </ThemeProvider>
    </OperatorLanguageProvider>
  )
}
