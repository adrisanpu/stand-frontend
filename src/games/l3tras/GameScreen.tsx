import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/widgets/QRCode'
import BackButton from '../../core/widgets/BackButton'
import type { L3trasSettings } from './GameConfig'
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

export default function L3trasGameScreen({ gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [settings, setSettings] = useState<L3trasSettings | null>(null)
  const [slots, setSlots] = useState<(string | null)[]>([])
  const [codeInput, setCodeInput] = useState('')
  const [usedCodes, setUsedCodes] = useState<string[]>([])
  const [, setCodesUsedOrder] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const slotsRef = useRef<(string | null)[]>([])
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const applySettings = (next: L3trasSettings) => {
    const lettersOnly = (next.objectiveWord || 'STAND').replace(/[^A-Za-z]/g, '')
    const upper: L3trasSettings = {
      objectiveWord: (lettersOnly || 'STAND').toUpperCase(),
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
  }

  useEffect(() => {
    if (!gameId) return

    const storageKey = `l3tras_settings_${gameId}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as L3trasSettings & { normalize?: unknown }
        applySettings({ objectiveWord: parsed.objectiveWord })
      } catch {
        applySettings({ objectiveWord: 'STAND' })
      }
    } else {
      applySettings({ objectiveWord: 'STAND' })
    }

    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const remote = data.settings?.l3tras
        if (remote?.objectiveWord) {
          const merged: L3trasSettings = {
            objectiveWord: remote.objectiveWord.toUpperCase(),
          }
          localStorage.setItem(storageKey, JSON.stringify(merged))
          applySettings(merged)
        }
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
      className={`flex flex-wrap justify-center gap-2 ${compact ? 'gap-1.5' : 'gap-3'}`}
      aria-label="Letras descubiertas"
    >
      {slots.map((ch, i) => (
        <div
          key={`${i}-${ch ?? '_'}`}
          className={`flex flex-col items-center justify-end border-b-2 border-white/25 ${
            compact ? 'min-w-[1.75rem] pb-0.5' : 'min-w-[2.25rem] pb-1'
          }`}
        >
          <span
            className={`font-bold text-[#10B981] font-mono tabular-nums ${
              ch ? 'animate-scale-in' : ''
            } ${compact ? 'text-xl min-h-[1.5rem]' : 'text-3xl sm:text-4xl min-h-[2.25rem]'}`}
          >
            {ch ?? '—'}
          </span>
        </div>
      ))}
    </div>
  )

  const renderCentralPanel = (compact: boolean) => (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {(gameState === 'idle' || gameState === 'checking') && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <p className={compact ? 'text-xs text-gray-400' : 'text-sm text-gray-400'}>Palabra objetivo</p>
            <p
              className={`font-bold tracking-widest text-[#34D399] ${
                compact ? 'text-lg' : 'text-2xl sm:text-3xl'
              }`}
            >
              {objectiveWord.split('').join(' ')}
            </p>
          </div>

          {renderHangmanRow(compact)}

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
            <div className={`flex items-center justify-center gap-3 ${compact ? 'py-6' : 'py-8'}`}>
              <svg className={`animate-spin text-[#10B981] ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className={`font-semibold text-[#10B981] ${compact ? 'text-base' : 'text-xl'}`}>Validando…</span>
            </div>
          ) : (
            <>
              <p className={compact ? 'text-xs text-gray-500 text-center' : 'text-sm text-gray-500 text-center'}>
                Introduce un código y pulsa Validar (uno cada vez).
              </p>
              <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row'}`}>
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
                  className={`flex-1 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center font-mono focus:border-[rgba(16,185,129,0.5)] focus:outline-none ${
                    compact ? 'h-12 text-sm px-3' : 'h-14 text-lg px-4'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => void validateOneCode()}
                  className={`rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.3)] transition-colors font-semibold disabled:opacity-50 whitespace-nowrap ${
                    compact ? 'h-12 px-4 text-sm' : 'h-14 px-6 text-base sm:shrink-0'
                  }`}
                >
                  Validar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {gameState === 'success' && (
        <div className="animate-fade-in space-y-4">
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

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(180px,260px)] gap-3 sm:gap-4 lg:gap-6 items-stretch h-full min-h-0">
        <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0">
          <div className="grid grid-cols-2 gap-2 items-center flex-shrink-0 min-h-0">
            <div className="flex justify-center min-h-0 w-full min-w-0">
              <QRCode data={getInstagramDmUrl(gameId)} size={200} margin={6} containerClassName="max-h-[min(18vh,160px)] w-full" alt="QR Code para Instagram DM" className="!border-0 !bg-transparent !p-0" />
            </div>
            <div className="flex justify-center items-center min-h-0">
              {logoElement}
            </div>
          </div>
          <div className="flex-shrink-0 min-h-0 overflow-hidden">
            <h3 className="text-xs font-semibold text-textMain mb-1">Instrucciones</h3>
            <ol className="flex flex-col gap-1.5 text-xs text-gray-300">
              <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-[10px]">1</span><span className="pt-0.5">📸 Escanea el QR y pulsa JUGAR.</span></li>
              <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-[10px]">2</span><span className="pt-0.5">🔤 Cada jugador recibe un código (letra).</span></li>
              <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-[10px]">3</span><span className="pt-0.5">👥 Reuníos; cada uno tendrá su código.</span></li>
              <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-[10px]">4</span><span className="pt-0.5">✅ Introducid los códigos de uno en uno en el validador.</span></li>
            </ol>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
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
      <div className={showJoinBlock ? 'space-y-6' : 'flex flex-col flex-1 min-h-0 space-y-4'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex justify-center items-start">
            <QRCode
              data={getInstagramDmUrl(gameId)}
              size={380}
              margin={12}
              alt="QR Code para Instagram DM"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
            <ol className="space-y-4 text-base text-gray-300">
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
