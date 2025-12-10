import { useState, useEffect } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`
const API_BASE = "https://3u0n7y51m9.execute-api.us-east-1.amazonaws.com/prod"

type ValidationResponse = {
  valid: boolean
  gameId: string
  pairId: string | null
  players: Array<{
    playerId: number
    instagramUsername: string
    characterId: number
    characterName: string
  }>
  message: string
  notified?: boolean
}

export default function Empareja2GameScreen({ gameName, gameId }: GameScreenProps) {
  const [code1, setCode1] = useState('')
  const [code2, setCode2] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCodeChange = (value: string, setter: (value: string) => void) => {
    // Only allow numeric input and limit to 4 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setter(numericValue)
  }

  const validateCodes = async () => {
    if (!code1 || !code2 || code1.length !== 4 || code2.length !== 4) {
      setError('Ambos códigos deben tener 4 dígitos')
      return
    }

    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    try {
      const response = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId,
          codes: [code1, code2]
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || 'Error al validar los códigos')
      }

      const result: ValidationResponse = await response.json()
      setValidationResult(result)
    } catch (err: any) {
      setError(err.message || 'Error al validar los códigos')
    } finally {
      setIsValidating(false)
    }
  }

  // Auto-reset after 5 seconds when validation is successful
  useEffect(() => {
    if (validationResult?.valid) {
      const timeout = setTimeout(() => {
        setCode1('')
        setCode2('')
        setValidationResult(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [validationResult?.valid])

  return (
    <div className="w-full space-y-6">
      {/* Game Code - Always visible */}
      <div className="text-center">
        <div className="p-4 rounded-xl bg-[rgba(176,38,255,0.15)] border border-[rgba(176,38,255,0.3)]">
          <p className="text-sm text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-3xl font-bold tracking-wider text-neonMagenta">{gameId}</p>
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
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">1</span>
              <span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">2</span>
              <span className="pt-0.5">Envía el código de partida en ese chat para recibir tu pareja asignada.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">3</span>
              <span className="pt-0.5">Encuentra a tu pareja físicamente.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">4</span>
              <span className="pt-0.5">Cuando os encontréis, validad juntos vuestros códigos.</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Validator - Only show when not validated or after reset */}
      {!validationResult?.valid && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-textMain">Validador de Parejas</h3>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Code Input Fields - Side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="code1" className="block text-sm font-medium text-gray-300 mb-1">
                Código del Jugador 1
              </label>
              <input
                id="code1"
                type="text"
                value={code1}
                onChange={(e) => handleCodeChange(e.target.value, setCode1)}
                placeholder="1234"
                maxLength={4}
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-base font-mono focus:border-white/20 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="code2" className="block text-sm font-medium text-gray-300 mb-1">
                Código del Jugador 2
              </label>
              <input
                id="code2"
                type="text"
                value={code2}
                onChange={(e) => handleCodeChange(e.target.value, setCode2)}
                placeholder="5678"
                maxLength={4}
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-base font-mono focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Validation Button */}
          <button
            onClick={validateCodes}
            disabled={isValidating || code1.length !== 4 || code2.length !== 4}
            className="w-full p-3 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <div className="flex items-center justify-center gap-2">
              {isValidating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Validando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Validar Códigos
                </>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Winning Animation - Show when validated successfully */}
      {validationResult?.valid && validationResult.players && validationResult.players.length === 2 && (
        <div className="animate-fade-in">
          {/* Player 1 | Success Message | Player 2 - All in one row */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Player 1 */}
            <div className="flex flex-col items-center space-y-3 animate-scale-in">
              {(() => {
                const player = validationResult.players[0]
                const imgUrl = player.characterName 
                  ? `https://empareja2-characters.s3.us-east-1.amazonaws.com/${player.characterName}.png`
                  : null
                return (
                  <>
                    <div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={player.characterName || 'Jugador 1'}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      ) : (
                        <div className="text-xs text-gray-500">Imagen jugador 1</div>
                      )}
                    </div>
                    {player.instagramUsername && (
                      <div className="text-center">
                        <p className="text-base font-semibold text-neonMagenta">{player.instagramUsername}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Success Message - Middle */}
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xl font-semibold text-green-400">¡Pareja Válida!</span>
              </div>
              {validationResult.message && (
                <p className="text-sm text-green-300">{validationResult.message}</p>
              )}
            </div>

            {/* Player 2 */}
            <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              {(() => {
                const player = validationResult.players[1]
                const imgUrl = player.characterName 
                  ? `https://empareja2-characters.s3.us-east-1.amazonaws.com/${player.characterName}.png`
                  : null
                return (
                  <>
                    <div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={player.characterName || 'Jugador 2'}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      ) : (
                        <div className="text-xs text-gray-500">Imagen jugador 2</div>
                      )}
                    </div>
                    {player.instagramUsername && (
                      <div className="text-center">
                        <p className="text-base font-semibold text-neonMagenta">{player.instagramUsername}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Invalid Result */}
      {validationResult && !validationResult.valid && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-lg font-semibold text-red-400">Pareja Inválida</span>
          </div>
          {validationResult.message && (
            <p className="text-sm text-red-300">{validationResult.message}</p>
          )}
        </div>
      )}
    </div>
  )
}

