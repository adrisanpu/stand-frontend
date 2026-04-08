import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/widgets/QRCode'
import GameLandscapeInfoColumn from '../../core/widgets/GameLandscapeInfoColumn'
import BackButton from '../../core/widgets/BackButton'
import type { L3trasSettings } from './GameConfig'
import { normalizeValidationTimeLimitSeconds } from './GameConfig'
import { getInstagramDmUrl } from '../../core/lib/instagram'
import { api } from '../../api/api'

type GameState = 'idle' | 'checking' | 'success'

type ValidationResponse = {
  valid: boolean
  gameId: string
  players?: Array<{
    playerId: number
    instagramUsername?: string
    letter?: string
    [key: string]: unknown
  }>
  results?: Array<{
    code: string
    letter?: string
    [key: string]: unknown
  }>
  message?: string
}

type GameDataResponse = {
  ok: boolean
  settings?: { l3tras?: L3trasSettings }
}

function pickLetter(result: ValidationResponse): string | null {
  const p = result.players?.[0]?.letter
  if (typeof p === 'string' && p.length === 1) return p.toUpperCase()
  const r = result.results?.[0]?.letter
  if (typeof r === 'string' && r.length === 1) return r.toUpperCase()
  return null
}

function L3trasPieTimer({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0
  const sec = Math.max(0, Math.ceil(remainingMs / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const label = `${m}:${String(s).padStart(2, '0')}`
  const pct = fraction * 100
  const urgent = sec > 0 && sec <= 10
  const ring = urgent ? 'rgba(248,113,113,0.95)' : 'rgba(16,185,129,0.95)'
  return (
    <div className="pointer-events-none shrink-0" title="Tiempo restante para completar la palabra">
      <div
        className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/20 shadow-md"
        style={{
          background: `conic-gradient(from -90deg, ${ring} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      >
        <div className="absolute inset-[6px] flex items-center justify-center rounded-full bg-[rgba(17,24,39,0.96)] text-xs font-mono font-semibold tabular-nums">
          <span className={urgent ? 'text-red-400' : 'text-[#34D399]'}>{label}</span>
        </div>
      </div>
    </div>
  )
}

export default function L3trasGameScreen({ gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [settings, setSettings] = useState<L3trasSettings | null>(null)
  const [slots, setSlots] = useState<(string | null)[]>([])
  const [codeInput, setCodeInput] = useState('')
  const [usedCodes, setUsedCodes] = useState<string[]>([])
  const [, setCodesUsedOrder] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [timerSession, setTimerSession] = useState(0)
  const [timerTick, setTimerTick] = useState(0)
  const slotsRef = useRef<(string | null)[]>([])
  const roundEndTimeRef = useRef<number | null>(null)
  const roundDurationMsRef = useRef(0)
  const gameIdRef = useRef(gameId)
  gameIdRef.current = gameId
  const settingsRef = useRef<L3trasSettings | null>(null)
  settingsRef.current = settings

  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const applySettings = (next: L3trasSettings) => {
    roundEndTimeRef.current = null
    roundDurationMsRef.current = 0
    const lettersOnly = (next.objectiveWord || 'STAND').replace(/[^A-Za-z]/g, '')
    const upper: L3trasSettings = {
      objectiveWord: (lettersOnly || 'STAND').toUpperCase(),
      validationTimeLimitSeconds: normalizeValidationTimeLimitSeconds(next.validationTimeLimitSeconds),
    }
    setSettings(upper)
    const wordLength = upper.objectiveWord.length
    setSlots(new Array(wordLength).fill(null))
    setCodeInput('')
    setUsedCodes([])
    setCodesUsedOrder([])
    setError(null)
    setMessage(null)
    setGameState('idle')
    setTimerSession((s) => s + 1)
  }

  const handleTimeUpRef = useRef<() => void>(() => {})
  handleTimeUpRef.current = () => {
    const word = settingsRef.current?.objectiveWord || 'STAND'
    roundEndTimeRef.current = null
    roundDurationMsRef.current = 0
    setSlots(new Array(word.length).fill(null))
    setCodeInput('')
    setUsedCodes([])
    setCodesUsedOrder([])
    setGameState('idle')
    setError('Se acabó el tiempo. Volvéis a empezar.')
    setMessage(null)
    setTimerSession((s) => s + 1)
    const gid = gameIdRef.current
    if (gid) {
      void api
        .post('/v1/game/score', {
          gameId: gid,
          codesUsed: [],
          objectiveWord: word,
          success: false,
        })
        .catch(() => {})
    }
  }

  useEffect(() => {
    if (gameState === 'success') return
    const end = roundEndTimeRef.current
    if (end === null) return
    const id = window.setInterval(() => {
      const now = Date.now()
      if (now >= end) {
        window.clearInterval(id)
        roundEndTimeRef.current = null
        roundDurationMsRef.current = 0
        handleTimeUpRef.current()
        return
      }
      setTimerTick((t) => t + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [gameState, timerSession])

  useEffect(() => {
    if (!gameId) return

    const storageKey = `l3tras_settings_${gameId}`
    const saved = localStorage.getItem(storageKey)
    let savedParsed: Partial<L3trasSettings> = {}
    if (saved) {
      try {
        savedParsed = JSON.parse(saved) as L3trasSettings & { normalize?: unknown }
      } catch {
        savedParsed = {}
      }
    }

    applySettings({
      objectiveWord:
        typeof savedParsed.objectiveWord === 'string' && savedParsed.objectiveWord
          ? savedParsed.objectiveWord
          : 'STAND',
      validationTimeLimitSeconds: savedParsed.validationTimeLimitSeconds,
    })

    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const remote = data.settings?.l3tras
        if (!remote || typeof remote !== 'object') return
        const hasRemoteWord =
          typeof remote.objectiveWord === 'string' && remote.objectiveWord.replace(/[^A-Za-z]/g, '').length > 0
        const hasRemoteTime = remote.validationTimeLimitSeconds != null
        if (!hasRemoteWord && !hasRemoteTime) return

        const fromRemoteWord = hasRemoteWord ? String(remote.objectiveWord) : ''
        const lettersOnly = fromRemoteWord.replace(/[^A-Za-z]/g, '')
        const fallbackWord =
          (typeof savedParsed.objectiveWord === 'string' && savedParsed.objectiveWord) || 'STAND'
        const merged: L3trasSettings = {
          objectiveWord: (lettersOnly || fallbackWord.replace(/[^A-Za-z]/g, '') || 'STAND').toUpperCase(),
          validationTimeLimitSeconds: normalizeValidationTimeLimitSeconds(
            remote.validationTimeLimitSeconds ?? savedParsed.validationTimeLimitSeconds,
          ),
        }
        localStorage.setItem(storageKey, JSON.stringify(merged))
        applySettings(merged)
      } catch {
        // keep localStorage / defaults
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applySettings resets board; run once per gameId
  }, [gameId])

  useEffect(() => {
    const w = settings?.objectiveWord
    if (!w) return
    setSlots((prev) => {
      if (prev.length === w.length) return prev
      return new Array(w.length).fill(null)
    })
  }, [settings?.objectiveWord])

  const submitScore = async (codesUsed: string[], objectiveWordStr: string, success: boolean) => {
    if (!gameId) return
    try {
      await api.post('/v1/game/score', {
        gameId,
        codesUsed,
        objectiveWord: objectiveWordStr,
        success,
      })
    } catch (err) {
      console.error('Error submitting score:', err)
    }
  }

  const validateOneCode = async () => {
    const word = settings?.objectiveWord
    if (!word) {
      setError('No hay palabra objetivo configurada. Configura el juego primero.')
      return
    }
    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    const trimmed = codeInput.replace(/\D/g, '').trim()
    if (!trimmed) {
      setError('Introduce un código.')
      return
    }

    if (usedCodes.includes(trimmed)) {
      setError('Ese código ya se ha usado.')
      return
    }

    setGameState('checking')
    setError(null)
    setMessage(null)

    try {
      const result = await api.post<ValidationResponse>('/v1/game/validate', {
        gameId,
        codes: [trimmed],
      })

      if (!result.valid) {
        setGameState('idle')
        setError(
          typeof result.message === 'string' && result.message
            ? result.message
            : 'Código no válido.'
        )
        return
      }

      const letter = pickLetter(result)
      if (!letter) {
        setGameState('idle')
        setError('No se pudo leer la letra del código.')
        return
      }

      setCodeInput('')

      if (roundEndTimeRef.current === null) {
        const limitMs = normalizeValidationTimeLimitSeconds(settings?.validationTimeLimitSeconds) * 1000
        roundEndTimeRef.current = Date.now() + limitMs
        roundDurationMsRef.current = limitMs
        setTimerSession((s) => s + 1)
      }

      const prevSlots = slotsRef.current
      const nextSlots =
        prevSlots.length === word.length
          ? [...prevSlots]
          : Array.from({ length: word.length }, (_, i) => prevSlots[i] ?? null)
      let filledAny = false
      for (let i = 0; i < word.length; i++) {
        if (word[i] === letter && nextSlots[i] === null) {
          nextSlots[i] = letter
          filledAny = true
        }
      }
      const complete = nextSlots.every((s) => s !== null)

      setSlots(nextSlots)
      setUsedCodes((u) => [...u, trimmed])
      setCodesUsedOrder((o) => {
        const order = [...o, trimmed]
        if (complete) {
          roundEndTimeRef.current = null
          roundDurationMsRef.current = 0
          setTimerSession((s) => s + 1)
          setGameState('success')
          setMessage('¡Habéis ganado!')
          void submitScore(order, word, true)
        } else {
          setGameState('idle')
          if (!filledAny) {
            setError('Esta letra ya estaba descubierta.')
          }
        }
        return order
      })
    } catch (err: unknown) {
      setGameState('idle')
      setError(err instanceof Error ? err.message : 'Error al validar el código')
    }
  }

  const handleReset = () => {
    roundEndTimeRef.current = null
    roundDurationMsRef.current = 0
    setTimerSession((s) => s + 1)
    const w = settings?.objectiveWord || 'STAND'
    setSlots(new Array(w.length).fill(null))
    setCodeInput('')
    setUsedCodes([])
    setCodesUsedOrder([])
    setError(null)
    setMessage(null)
    setGameState('idle')
  }

  const objectiveWord = settings?.objectiveWord || 'STAND'

  const showJoinBlock = gameState !== 'success'

  const renderHangmanRow = (compact: boolean) => (
    <div
      className={`flex flex-wrap justify-center ${compact ? 'gap-2 sm:gap-3' : 'gap-4 sm:gap-5'}`}
      aria-label="Letras descubiertas"
    >
      {slots.map((ch, i) => (
        <div
          key={`${i}-${ch ?? '_'}`}
          className={`flex flex-col items-center justify-end border-b-2 border-white/25 ${
            compact ? 'min-w-[2rem] sm:min-w-[2.25rem] pb-1' : 'min-w-[3rem] sm:min-w-[3.25rem] pb-1.5'
          }`}
        >
          <span
            className={`font-bold text-[#10B981] font-mono tabular-nums ${
              ch ? 'animate-scale-in' : ''
            } ${
              compact
                ? 'text-4xl sm:text-5xl lg:text-6xl min-h-[2.75rem] sm:min-h-[3.25rem]'
                : 'text-6xl sm:text-7xl lg:text-8xl min-h-[4.5rem] sm:min-h-[5rem] lg:min-h-[5.5rem]'
            }`}
          >
            {ch ?? ''}
          </span>
        </div>
      ))}
    </div>
  )

  const renderCentralPanel = (compact: boolean) => {
    const roundEnd = roundEndTimeRef.current
    const roundTotal = roundDurationMsRef.current
    const showRoundTimer =
      roundEnd !== null &&
      roundTotal > 0 &&
      (gameState === 'idle' || gameState === 'checking')
    const remainingMs = showRoundTimer ? Math.max(0, roundEnd - Date.now()) : 0
    void timerTick

    return (
    <div
      className={
        (compact
          ? `flex flex-col min-h-0 ${gameState === 'idle' || gameState === 'checking' ? 'flex-1' : 'space-y-6'}`
          : 'space-y-8') + ' relative'
      }
    >
      {showRoundTimer && (
        <div className="absolute right-0 top-0 z-10">
          <L3trasPieTimer remainingMs={remainingMs} totalMs={roundTotal} />
        </div>
      )}
      {(gameState === 'idle' || gameState === 'checking') && (
        <div
          className={
            compact
              ? 'flex flex-col flex-1 min-h-0 gap-0'
              : 'flex flex-col space-y-6'
          }
        >
          <div
            className={`text-center shrink-0 ${compact ? 'space-y-2' : 'space-y-2.5'} ${showRoundTimer ? 'pr-[3.25rem] sm:pr-14' : ''}`}
          >
            <p className={compact ? 'text-xs text-gray-400' : 'text-sm text-gray-400'}>Palabra objetivo</p>
            <p
              className={`font-bold tracking-[0.2em] sm:tracking-widest text-[#34D399] ${
                compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-5xl'
              }`}
            >
              {objectiveWord.split('').join(' ')}
            </p>
          </div>

          <div
            className={
              compact
                ? 'flex flex-1 min-h-0 w-full items-center justify-center py-2'
                : 'flex w-full min-h-[11rem] sm:min-h-[13rem] items-center justify-center py-4'
            }
          >
            {renderHangmanRow(compact)}
          </div>

          <div className={`shrink-0 space-y-4 ${compact ? 'mt-4 pt-4' : 'mt-4 pt-6 sm:pt-10'}`}>
            {error && (
              <div
                className={`rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 ${
                  compact ? 'p-3 text-sm' : 'p-4 text-base'
                }`}
              >
                {error}
              </div>
            )}

            {gameState === 'checking' ? (
              <div className={`flex items-center justify-center gap-3 ${compact ? 'py-4' : 'py-6'}`}>
                <svg className={`animate-spin text-[#10B981] ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className={`font-semibold text-[#10B981] ${compact ? 'text-base' : 'text-xl'}`}>Validando…</span>
              </div>
            ) : (
            <div className="flex gap-3 w-full max-w-md mx-auto sm:max-w-none">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 10))
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void validateOneCode()
                }}
                placeholder="Código"
                className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg text-center font-mono outline-none focus:border-[rgba(16,185,129,0.5)]"
              />
              <button
                type="button"
                onClick={() => void validateOneCode()}
                className="h-14 shrink-0 rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] px-8 text-lg font-semibold hover:bg-[rgba(16,185,129,0.3)] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                Validar
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {gameState === 'success' && (
        <div className="animate-fade-in space-y-6">
          <div
            className={`rounded-xl bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-center ${
              compact ? 'p-5' : 'p-8'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <svg className={compact ? 'w-7 h-7' : 'w-10 h-10'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={`font-semibold text-green-400 ${compact ? 'text-xl' : 'text-2xl'}`}>¡Habéis ganado!</span>
            </div>
            {message && (
              <p className={`text-green-300 mb-4 ${compact ? 'text-sm' : 'text-lg'}`}>{message}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {objectiveWord.split('').map((c, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center rounded-lg bg-[rgba(16,185,129,0.25)] border border-[rgba(16,185,129,0.45)] font-bold text-[#10B981] animate-scale-in ${
                    compact ? 'w-9 h-9 text-lg' : 'w-12 h-12 text-2xl'
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full p-3 rounded-xl bg-[rgba(0,245,255,0.2)] border border-[rgba(0,245,255,0.3)] hover:bg-[rgba(0,245,255,0.3)] transition-colors font-medium text-sm"
          >
            Reiniciar
          </button>
        </div>
      )}
    </div>
    )
  }

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(180px,260px)] gap-3 sm:gap-4 lg:gap-6 items-stretch h-full min-h-0">
        <GameLandscapeInfoColumn gameId={gameId} logoElement={logoElement}>
          <p>📸 Escanea el QR y pulsa JUGAR.</p>
          <p>🔤 Cada jugador recibe un código (letra).</p>
          <p>👥 Reuníos; cada uno tendrá su código.</p>
          <p>✅ Introducid los códigos de uno en uno en el validador.</p>
        </GameLandscapeInfoColumn>
        <div className="card flex flex-col flex-1 min-h-0 p-6 sm:p-8 overflow-hidden gap-6">
          {renderCentralPanel(true)}
        </div>
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full">
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full min-w-0 bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full flex flex-col ${!showJoinBlock ? 'min-h-[70vh]' : ''}`}>
      {!showJoinBlock && (
        <div className="flex justify-end mb-2">
          <BackButton onClick={handleReset} aria-label="Volver" />
        </div>
      )}
      <div className={showJoinBlock ? 'space-y-8' : 'flex flex-col flex-1 min-h-0 space-y-6'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex justify-center items-start">
            <QRCode
              data={getInstagramDmUrl(gameId)}
              size={380}
              margin={12}
              alt="QR Code para Instagram DM"
            />
          </div>

          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
            <ol className="space-y-5 text-base text-gray-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-sm">1</span>
                <span className="pt-0.5">Escanea el QR y pulsa JUGAR en el chat de Instagram.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-sm">2</span>
                <span className="pt-0.5">Cada jugador recibirá un código de validación asociado a una letra.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-sm">3</span>
                <span className="pt-0.5">Reuníos; cada participante tendrá su propio código.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-sm">4</span>
                <span className="pt-0.5">Introducid los códigos de uno en uno en el validador para descubrir la palabra.</span>
              </li>
            </ol>
          </div>
        </div>

        {renderCentralPanel(false)}
      </div>
    </div>
  )
}
