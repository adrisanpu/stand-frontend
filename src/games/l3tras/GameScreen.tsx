import { useState, useEffect } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'
import type { L3trasSettings } from './GameConfig'
import { api } from '../../api/api'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`

type GameState = 'idle' | 'checking' | 'success' | 'error'

type ValidationResponse = {
  valid: boolean
  gameId: string
  players?: Array<{
    playerId: number
    instagramUsername?: string
    letter?: string
    [key: string]: any
  }>
  results?: Array<{
    code: string
    letter?: string
    [key: string]: any
  }>
  message?: string
}

export default function L3trasGameScreen({ gameName, gameId }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [settings, setSettings] = useState<L3trasSettings | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [letters, setLetters] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Load settings from localStorage
  useEffect(() => {
    if (gameId) {
      const storageKey = `l3tras_settings_${gameId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as L3trasSettings
          setSettings(parsed)
          // Initialize codes array with empty strings based on word length
          const wordLength = parsed.objectiveWord?.length || 5
          setCodes(new Array(wordLength).fill(''))
        } catch {
          // Use default settings
          const defaultSettings: L3trasSettings = {
            objectiveWord: 'STAND',
            normalize: 'UPPER',
          }
          setSettings(defaultSettings)
          setCodes(new Array(5).fill(''))
        }
      } else {
        // Use default settings
        const defaultSettings: L3trasSettings = {
          objectiveWord: 'STAND',
          normalize: 'UPPER',
        }
        setSettings(defaultSettings)
        setCodes(new Array(5).fill(''))
      }
    }
  }, [gameId])

  // Update codes array length when settings change
  useEffect(() => {
    if (settings?.objectiveWord) {
      const wordLength = settings.objectiveWord.length
      if (codes.length !== wordLength) {
        setCodes(new Array(wordLength).fill(''))
      }
    }
  }, [settings?.objectiveWord])

  const handleCodeChange = (index: number, value: string) => {
    // Only allow alphanumeric, limit length
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()
    const newCodes = [...codes]
    newCodes[index] = cleaned
    setCodes(newCodes)
    setError(null)
    setMessage(null)

    // Auto-focus next input if current is filled
    if (cleaned.length >= 4 && index < codes.length - 1) {
      const nextInput = document.getElementById(`code-input-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
      }
    }
  }

  const validateWord = async () => {
    if (!settings?.objectiveWord) {
      setError('No hay palabra objetivo configurada. Configura el juego primero.')
      return
    }

    const trimmedCodes = codes.map(c => c.trim()).filter(c => c.length > 0)
    const requiredCount = settings.objectiveWord.length

    if (trimmedCodes.length !== requiredCount) {
      setError(`Se requieren exactamente ${requiredCount} código${requiredCount !== 1 ? 's' : ''}`)
      return
    }

    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    setGameState('checking')
    setError(null)
    setMessage(null)
    setLetters([])

    try {
      const result = await api.post<ValidationResponse>('/v1/game/validate', {
        gameId: gameId,
        codes: trimmedCodes
      })
      
      // Extract letters from response
      let extractedLetters: string[] = []
      
      if (result.players && result.players.length > 0) {
        // Try to get letters from players array
        extractedLetters = result.players
          .map(p => p.letter)
          .filter((l): l is string => typeof l === 'string' && l.length === 1)
      } else if (result.results && result.results.length > 0) {
        // Try to get letters from results array
        extractedLetters = result.results
          .map(r => r.letter)
          .filter((l): l is string => typeof l === 'string' && l.length === 1)
      }

      if (extractedLetters.length === 0) {
        // Backend doesn't return letters yet
        setError('El backend no devuelve letras todavía para L3tras. Por favor, contacta al administrador.')
        setGameState('error')
        return
      }

      setLetters(extractedLetters)

      // Normalize objective word and letters based on settings
      const normalizeFunc = settings.normalize === 'UPPER' 
        ? (s: string) => s.toUpperCase() 
        : (s: string) => s.toLowerCase()
      
      const normalizedObjective = normalizeFunc(settings.objectiveWord)
      const normalizedLetters = extractedLetters.map(normalizeFunc)

      // Check if letters can form the objective word (order independent)
      const objectiveSorted = [...normalizedObjective].sort().join('')
      const lettersSorted = [...normalizedLetters].sort().join('')

      if (objectiveSorted === lettersSorted) {
        setGameState('success')
        setMessage('¡Habéis ganado!')
        
        // Submit score
        submitScore(trimmedCodes, normalizedObjective, true)
      } else {
        setGameState('error')
        setError('Las letras no forman la palabra objetivo. Volved a intentarlo.')
        submitScore(trimmedCodes, normalizedObjective, false)
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar los códigos')
      setGameState('error')
    }
  }

  const submitScore = async (codesUsed: string[], objectiveWord: string, success: boolean) => {
    if (!gameId) return

    try {
      await api.post('/v1/game/score', {
        gameId: gameId,
        codesUsed: codesUsed,
        objectiveWord: objectiveWord,
        success: success,
      })
    } catch (err) {
      // Don't show error to user, just log it
      console.error('Error submitting score:', err)
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setCodes(new Array(settings?.objectiveWord?.length || 5).fill(''))
    setLetters([])
    setError(null)
    setMessage(null)
  }

  const objectiveWord = settings?.objectiveWord || 'STAND'
  const requiredCount = objectiveWord.length
  const allCodesFilled = codes.every(c => c.trim().length > 0)

  return (
    <div className="w-full space-y-6">
      {/* Game Code - Always visible */}
      <div className="text-center">
        <div className="p-4 rounded-xl bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)]">
          <p className="text-sm text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-3xl font-bold tracking-wider text-[#10B981]">{gameId}</p>
        </div>
      </div>

      {/* QR Code and Instructions - Two columns, always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* QR Code - Left column */}
        <div className="flex justify-center items-start">
          <QRCode 
            data={INSTAGRAM_DM_URL}
            size={200}
            margin={8}
            alt="QR Code para Instagram DM"
          />
        </div>

        {/* Instructions - Right column */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-textMain mb-3">Instrucciones</h3>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-xs">1</span>
              <span className="pt-0.5">Escanea el QR y envía el código de partida al chat de Instagram.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-xs">2</span>
              <span className="pt-0.5">Cada jugador recibirá un código de validación asociado a una letra.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-xs">3</span>
              <span className="pt-0.5">Reuníos y juntad todos los códigos (tantos como letras tenga la palabra).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] flex items-center justify-center font-semibold text-[#10B981] text-xs">4</span>
              <span className="pt-0.5">Introducidlos en el validador para comprobar si formáis la palabra objetivo.</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Validator - Only show when idle or error */}
      {(gameState === 'idle' || gameState === 'error') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-textMain">Validador de Palabra</h3>
            {settings?.objectiveWord && (
              <p className="text-sm text-gray-400">
                Se requieren {requiredCount} código{requiredCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {error && gameState === 'error' && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Code Input Fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {codes.map((code, index) => (
              <div key={index}>
                <label htmlFor={`code-input-${index}`} className="block text-xs font-medium text-gray-400 mb-1">
                  Código {index + 1}
                </label>
                <input
                  id={`code-input-${index}`}
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && allCodesFilled) {
                      validateWord()
                    }
                  }}
                  placeholder={`Código ${index + 1}`}
                  maxLength={10}
                  className="w-full h-11 px-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-sm font-mono focus:border-[rgba(16,185,129,0.5)] focus:outline-none uppercase"
                />
              </div>
            ))}
          </div>

          {/* Validation Button */}
          <button
            onClick={validateWord}
            disabled={!allCodesFilled}
            className="w-full p-3 rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validar Palabra
            </div>
          </button>
        </div>
      )}

      {/* Checking State */}
      {gameState === 'checking' && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6 animate-spin text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-xl font-semibold text-[#10B981]">Validando códigos...</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {gameState === 'success' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-6 rounded-xl bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-2xl font-semibold text-green-400">¡Habéis ganado!</span>
            </div>
            
            {message && (
              <p className="text-lg text-green-300 mb-4">{message}</p>
            )}

            {/* Letter Tiles */}
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-3">Palabra formada:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {letters.map((letter, index) => (
                  <div
                    key={index}
                    className="w-12 h-12 rounded-xl bg-[rgba(16,185,129,0.2)] border-2 border-[rgba(16,185,129,0.5)] flex items-center justify-center text-2xl font-bold text-[#10B981] shadow-lg animate-scale-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
            </div>

            {/* Objective Word Display */}
            <div className="mt-4 p-3 rounded-lg bg-[rgba(52,211,153,0.2)] border border-[rgba(52,211,153,0.3)]">
              <p className="text-xs text-gray-400 mb-1">Palabra objetivo:</p>
              <p className="text-xl font-bold text-[#34D399]">
                {objectiveWord.split('').join(' ')}
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full p-3 rounded-xl bg-[rgba(0,245,255,0.2)] border border-[rgba(0,245,255,0.3)] hover:bg-[rgba(0,245,255,0.3)] transition-colors font-medium"
          >
            Reiniciar
          </button>
        </div>
      )}

      {/* Error State (after validation) */}
      {gameState === 'error' && error && !codes.some(c => c.trim().length === 0) && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-lg font-semibold text-red-400">Palabra Incorrecta</span>
          </div>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={handleReset}
            className="w-full p-3 rounded-xl bg-[rgba(0,245,255,0.2)] border border-[rgba(0,245,255,0.3)] hover:bg-[rgba(0,245,255,0.3)] transition-colors font-medium"
          >
            Reiniciar
          </button>
        </div>
      )}
    </div>
  )
}

