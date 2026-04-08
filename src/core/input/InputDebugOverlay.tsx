import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * LG mando estándar / función completa en webOS (p. ej. SRS23CW · AKB76044732 con monitor Swing táctil).
 * Basado en tablas de comunidad webOS + mapeo DOM habitual; el firmware puede variar — el historial del overlay es la fuente de verdad.
 * @see https://gist.github.com/Simon34545/31c528bfe8540880936fc4c580723a02
 */
const LG_WEBOS_REMOTE_KEYCODE_HINTS: Record<number, string> = {
  // Teclado DOM (muchos navegadores / enfoques mapean igual)
  13: 'Enter / OK (DOM)',
  37: 'Izquierda (DOM ArrowLeft)',
  38: 'Arriba (DOM ArrowUp)',
  39: 'Derecha (DOM ArrowRight)',
  40: 'Abajo (DOM ArrowDown)',
  461: 'Atrás (webOS, muy habitual en apps)',
  10009: 'Atrás (Tizen / otro TV)',
  19: 'Pausa (webOS / media)',
  // Cruceta y OK remoto LG físico (keyCode propio webOS)
  103: 'Arriba (LG)',
  105: 'Izquierda (LG)',
  28: 'OK / Enter (LG)',
  106: 'Derecha (LG)',
  108: 'Abajo (LG)',
  412: 'Atrás (LG remoto completo)',
  174: 'Salir / Exit',
  // Dígitos LG (no son 48–57)
  2: 'Tecla 1',
  3: 'Tecla 2',
  4: 'Tecla 3',
  5: 'Tecla 4',
  6: 'Tecla 5',
  7: 'Tecla 6',
  8: 'Tecla 7',
  9: 'Tecla 8',
  10: 'Tecla 9',
  11: 'Tecla 0',
  // Volumen / canal / audio
  115: 'Volumen +',
  114: 'Volumen −',
  113: 'Silencio',
  402: 'Canal +',
  403: 'Canal −',
  // Navegación y menús
  139: 'Menú',
  358: 'Info',
  771: 'Lista canales',
  772: 'Flashback',
  364: 'Favoritos',
  773: 'Home (RF)',
  217: 'Buscar',
  377: 'TV',
  116: 'Power',
  241: 'TV / Video',
  799: 'CC subtítulos',
  934: 'Manual RF',
  1027: 'Live zoom',
  // Streaming (etiquetas típicas)
  1037: 'Netflix',
  1038: 'Prime / app OTT',
  // Transporte
  207: 'Play',
  119: 'Pausa',
  128: 'Stop',
  168: 'Retroceder',
  208: 'Avance rápido',
  415: 'Play (webOS media)',
  417: 'Avance rápido (webOS)',
  413: 'Stop (webOS)',
  398: 'Rojo',
  399: 'Verde',
  400: 'Amarillo',
  401: 'Azul',
  829: 'AD',
  795: 'Temporizador',
}

function hintForKeyEvent(keyCode: number, code: string): string {
  const fromTable = LG_WEBOS_REMOTE_KEYCODE_HINTS[keyCode]
  if (fromTable) return fromTable
  if (code === 'BrowserBack' || code === 'GoBack') return 'Atrás (code BrowserBack/GoBack)'
  return ''
}

type DebugEntry = {
  phase: 'keydown' | 'keyup'
  key: string
  code: string
  keyCode: number
  which: number
  repeat: boolean
  t: number
  hint: string
}

function inputDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (/\binputDebug=0\b/.test(window.location.search)) return false
    if (/\binputDebug=1\b/.test(window.location.search)) return true
  }
  const env = import.meta.env.VITE_INPUT_DEBUG as string | undefined
  if (env === 'false') return false
  if (env === 'true') return true
  return true
}

const OVERLAY_Z = 2147483000
const HISTORY_MAX = 14

export default function InputDebugOverlay() {
  const [history, setHistory] = useState<DebugEntry[]>([])
  const enabled = inputDebugEnabled()

  useEffect(() => {
    if (!enabled) return

    const pushKey = (e: KeyboardEvent, phase: 'keydown' | 'keyup') => {
      const hint = hintForKeyEvent(e.keyCode, e.code)
      const entry: DebugEntry = {
        phase,
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        which: e.which,
        repeat: e.repeat,
        t: Date.now(),
        hint,
      }
      setHistory((prev) => {
        const next = [entry, ...prev]
        return next.slice(0, HISTORY_MAX)
      })
    }

    const onKeyDown = (e: KeyboardEvent) => pushKey(e, 'keydown')
    const onKeyUp = (e: KeyboardEvent) => pushKey(e, 'keyup')

    const onClick = () => {
      setHistory((prev) => {
        const entry: DebugEntry = {
          phase: 'keydown',
          key: '(click)',
          code: '—',
          keyCode: 0,
          which: 0,
          repeat: false,
          t: Date.now(),
          hint: 'pointer click',
        }
        return [entry, ...prev].slice(0, HISTORY_MAX)
      })
    }
    const onTouchStart = () => {
      setHistory((prev) => {
        const entry: DebugEntry = {
          phase: 'keydown',
          key: '(touch)',
          code: '—',
          keyCode: 0,
          which: 0,
          repeat: false,
          t: Date.now(),
          hint: 'touch',
        }
        return [entry, ...prev].slice(0, HISTORY_MAX)
      })
    }
    const onPointerDown = (e: PointerEvent) => {
      setHistory((prev) => {
        const entry: DebugEntry = {
          phase: 'keydown',
          key: `(pointer:${e.pointerType})`,
          code: '—',
          keyCode: 0,
          which: 0,
          repeat: false,
          t: Date.now(),
          hint: 'pointer',
        }
        return [entry, ...prev].slice(0, HISTORY_MAX)
      })
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('touchstart', onTouchStart, true)
    window.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('touchstart', onTouchStart, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [enabled])

  if (!enabled) return null

  const panelClass =
    'fixed bottom-2 left-2 max-w-[min(100vw-1rem,480px)] rounded-lg border border-white/20 bg-black/90 px-3 py-2 font-mono text-[11px] leading-snug pointer-events-none shadow-lg max-h-[min(70vh,520px)] overflow-y-auto'

  const latest = history[0]

  const node = (
    <div className={`${panelClass} text-green-300`} style={{ zIndex: OVERLAY_Z }} aria-hidden>
      <div className="text-white/70 text-[10px] uppercase tracking-wide mb-1">
        Input debug · LG Swing — SRS23CW (AKB76044732)
      </div>
      {!latest ? (
        <div className="text-amber-200/90">
          Pulsa el mando IR o toca la pantalla Swing: keyCode / key / code. El táctil suele verse como pointer/touch; la
          cruceta LG a veces usa códigos propios (p. ej. 103/105/106/108) y otras veces flechas DOM (37–40).
        </div>
      ) : (
        <>
          <div className="text-white/50 text-[10px] mb-1">Último evento</div>
          <div className="border-b border-white/10 pb-2 mb-2 text-emerald-200">
            <div>
              <span className="text-white/40">{latest.phase}</span> · keyCode{' '}
              <span className="text-white font-semibold">{latest.keyCode}</span>
              {latest.which !== latest.keyCode && latest.which ? (
                <span className="text-white/50"> · which {latest.which}</span>
              ) : null}
            </div>
            <div>key: {latest.key || '—'}</div>
            <div>code: {latest.code || '—'}</div>
            {latest.repeat ? <div className="text-amber-300/90">repeat: sí (mantén pulsado)</div> : null}
            {latest.hint ? <div className="text-cyan-300/90 mt-0.5">→ {latest.hint}</div> : null}
          </div>
          {history.length > 1 ? (
            <>
              <div className="text-white/50 text-[10px] mb-1">Historial ({history.length})</div>
              <ul className="space-y-1 text-[10px] text-green-200/85">
                {history.slice(1).map((s, i) => (
                  <li key={`${s.t}-${i}`} className="border-l border-white/15 pl-2">
                    <span className="text-white/35">{s.phase}</span> keyCode{' '}
                    <span className="text-white/90">{s.keyCode}</span>
                    {s.hint ? <span className="text-cyan-400/70"> · {s.hint}</span> : null}
                    <div className="text-white/40 truncate" title={`${s.key} / ${s.code}`}>
                      {s.key} · {s.code}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <details className="mt-3 pt-2 border-t border-white/10 text-[9px] text-white/45 pointer-events-auto">
            <summary className="cursor-pointer text-white/55 hover:text-white/75 select-none">
              Tabla referencia LG webOS (mando estándar, keyCode)
            </summary>
            <p className="mt-1 mb-1">
              Referencia orientativa para LG SRS23CW / AKB76044732 y webOS; confirma en dispositivo con el historial.
            </p>
            <ul className="columns-2 gap-2 list-none space-y-0.5">
              {Object.entries(LG_WEBOS_REMOTE_KEYCODE_HINTS)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([code, name]) => (
                  <li key={code}>
                    <span className="text-amber-200/80">{code}</span> → {name}
                  </li>
                ))}
            </ul>
          </details>
        </>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
