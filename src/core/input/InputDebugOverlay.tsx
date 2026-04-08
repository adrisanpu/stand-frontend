import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function hintForKeyEvent(keyCode: number, code: string): string {
  if (keyCode === 33 || code === 'PageUp') return 'PageUp → juego: up'
  if (keyCode === 34 || code === 'PageDown') return 'PageDown → juego: down'
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

/** Desactivado por defecto. Activar: ?inputDebug=1 o VITE_INPUT_DEBUG=true */
function inputDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (/\binputDebug=0\b/.test(window.location.search)) return false
    if (/\binputDebug=1\b/.test(window.location.search)) return true
  }
  return import.meta.env.VITE_INPUT_DEBUG === 'true'
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
      setHistory((prev) => [entry, ...prev].slice(0, HISTORY_MAX))
    }

    const onKeyDown = (e: KeyboardEvent) => pushKey(e, 'keydown')
    const onKeyUp = (e: KeyboardEvent) => pushKey(e, 'keyup')
    const onClick = () => {
      setHistory((prev) =>
        [
          {
            phase: 'keydown' as const,
            key: '(click)',
            code: '—',
            keyCode: 0,
            which: 0,
            repeat: false,
            t: Date.now(),
            hint: 'click → juego (inputManager)',
          },
          ...prev,
        ].slice(0, HISTORY_MAX)
      )
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [enabled])

  if (!enabled) return null

  const panelClass =
    'fixed bottom-2 left-2 max-w-[min(100vw-1rem,420px)] rounded-lg border border-white/20 bg-black/90 px-3 py-2 font-mono text-[11px] leading-snug pointer-events-none shadow-lg max-h-[min(60vh,400px)] overflow-y-auto'

  const latest = history[0]

  const node = (
    <div className={`${panelClass} text-green-300`} style={{ zIndex: OVERLAY_Z }} aria-hidden>
      <div className="text-white/70 text-[10px] uppercase tracking-wide mb-1">Input debug</div>
      <p className="text-white/45 text-[9px] mb-2 leading-relaxed">
        Juegos: <span className="text-amber-200/90">PageUp (33)</span> · <span className="text-amber-200/90">PageDown (34)</span> ·{' '}
        <span className="text-amber-200/90">click</span>. Atrás del mando/SO no aparece como acción de juego.
      </p>
      {!latest ? (
        <div className="text-amber-200/90">Esperando teclas o clic…</div>
      ) : (
        <>
          <div className="text-white/50 text-[10px] mb-1">Último</div>
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
            {latest.repeat ? <div className="text-amber-300/90">repeat</div> : null}
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
        </>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
