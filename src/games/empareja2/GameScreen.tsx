import { useState, useEffect } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'
import BackButton from '../../core/BackButton'
import { api } from '../../api/api'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`

type GameState = 'idle' | 'validating' | 'valid' | 'invalid' | 'finished'

type ValidationResponse = {
  valid: boolean
  gameId: string
  pairId: string | null
  players: Array<{
    playerId: number
    instagramUsername: string
    characterId: number
    characterName: string
    characterImageUrl?: string | null
  }>
  message: string
  notified?: boolean
}

export default function Empareja2GameScreen({ gameName, gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [code1, setCode1] = useState('')
  const [code2, setCode2] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvalidMessage, setShowInvalidMessage] = useState(false)

  // Ocultar mensaje de error/inválido tras 3 segundos
  useEffect(() => {
    if (gameState !== 'invalid') {
      setShowInvalidMessage(false)
      return
    }
    setShowInvalidMessage(true)
    const t = setTimeout(() => setShowInvalidMessage(false), 3000)
    return () => clearTimeout(t)
  }, [gameState])

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

    setGameState('validating')
    setError(null)
    setValidationResult(null)

    try {
      const result = await api.post<ValidationResponse>('/v1/game/validate', {
        gameId: gameId,
        codes: [code1, code2]
      })
      setValidationResult(result)
      
      if (result.valid) {
        setGameState('valid')
      } else {
        setGameState('invalid')
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar los códigos')
      setGameState('invalid')
    }
  }

  const handleReset = () => {
    // Reset everything for next validation
    setGameState('idle')
    setCode1('')
    setCode2('')
    setValidationResult(null)
    setError(null)
  }

  const showJoinBlock = gameState !== 'valid'

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_200px] gap-4 sm:gap-6 items-stretch h-full min-h-0">
        {/* Left: QR + code + instructions (large, readable) */}
        <div className="card flex flex-col gap-3 p-4 sm:p-5 overflow-hidden min-h-0">
          <div className="grid grid-cols-2 gap-3 items-center flex-shrink-0">
            <div className="flex justify-center">
              <QRCode data={INSTAGRAM_DM_URL} size={200} margin={8} alt="QR Code para Instagram DM" className="!border-0 !bg-transparent" />
            </div>
            <div className="text-center">
              <div className="p-3 rounded-xl bg-[rgba(176,38,255,0.12)]">
                <p className="text-xs text-gray-300 mb-1">Código de partida {gameName}:</p>
                <p className="text-xl font-bold tracking-wider text-neonMagenta">{gameId}</p>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <h3 className="text-sm font-semibold text-textMain mb-2">Instrucciones</h3>
            <ol className="flex flex-col gap-2 space-y-2 text-sm text-gray-300">
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">1</span>
                <span>Escanea el QR para obtener tu código de jugador.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">2</span>
                <span>Envía el código de partida en ese chat para recibir tu pareja asignada.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">3</span>
                <span>Encuentra a tu pareja físicamente.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-xs">4</span>
                <span>Cuando os encontréis, validad juntos vuestros códigos.</span>
              </li>
            </ol>
          </div>
        </div>
        {/* Center: validation + animations (large) */}
        <div className="card flex flex-col justify-center p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
          {(gameState === 'idle' || gameState === 'invalid') && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-textMain">Validador de Parejas</h3>
              {error && gameState === 'invalid' && showInvalidMessage && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-5">
                <div><label htmlFor="code1" className="block text-sm font-medium text-gray-300 mb-2">Código del Jugador 1</label><input id="code1" type="number" inputMode="numeric" min={1000} max={9999} value={code1} onChange={(e) => handleCodeChange(e.target.value, setCode1)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
                <div><label htmlFor="code2" className="block text-sm font-medium text-gray-300 mb-2">Código del Jugador 2</label><input id="code2" type="number" inputMode="numeric" min={1000} max={9999} value={code2} onChange={(e) => handleCodeChange(e.target.value, setCode2)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
              </div>
              <button onClick={validateCodes} disabled={code1.length !== 4 || code2.length !== 4} className="w-full p-5 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"><div className="flex items-center justify-center gap-3"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Validar Códigos</div></button>
            </div>
          )}
          {gameState === 'validating' && <div className="text-center py-10"><div className="flex items-center justify-center gap-4"><svg className="w-8 h-8 animate-spin text-neonMagenta" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg><p className="text-2xl font-semibold text-neonMagenta">Validando códigos...</p></div></div>}
          {gameState === 'valid' && validationResult?.valid && validationResult.players && validationResult.players.length === 2 && (
            <div className="animate-fade-in grid grid-cols-3 gap-4 items-center">
              <div className="flex flex-col items-center space-y-3 animate-scale-in">{(() => { const player = validationResult.players[0]; const imgUrl = player.characterImageUrl || null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 1'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Imagen jugador 1</div>}</div>{player.instagramUsername && <div className="text-center"><p className="text-base font-semibold text-neonMagenta">{player.instagramUsername}</p></div>}</>); })()}</div>
              <div className="flex flex-col items-center justify-center space-y-4 text-center"><span className="text-2xl font-semibold text-green-400">¡Pareja Válida!</span><BackButton onClick={handleReset} aria-label="Validar otra pareja" /></div>
              <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>{(() => { const player = validationResult.players[1]; const imgUrl = player.characterImageUrl || null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 2'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Imagen jugador 2</div>}</div>{player.instagramUsername && <div className="text-center"><p className="text-base font-semibold text-neonMagenta">{player.instagramUsername}</p></div>}</>); })()}</div>
            </div>
          )}
          {gameState === 'invalid' && validationResult && !validationResult.valid && showInvalidMessage && <div className="p-5 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in"><div className="flex items-center justify-center gap-3 mb-2"><svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span className="text-xl font-semibold text-red-400">Pareja Inválida</span></div>{(validationResult.message || error) && <p className="text-base text-red-300">{validationResult.message || error}</p>}</div>}
        </div>
        {/* Right: logo + letras, then mini containers (no scroll, fit; tight gap) */}
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full max-w-[200px]">
          <div className="flex justify-center shrink-0 origin-top -mb-3" style={{ transform: 'scale(0.88)', transformOrigin: 'top center' }}>
            {logoElement}
          </div>
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div className={showJoinBlock ? 'flex flex-col gap-6' : 'flex flex-col flex-1 min-h-0 gap-6'}>
      {/* Game Code - Always visible */}
      <div className="text-center flex-shrink-0">
        <div className="p-5 rounded-xl bg-[rgba(176,38,255,0.12)]">
          <p className="text-base text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-4xl lg:text-5xl font-bold tracking-wider text-neonMagenta">{gameId}</p>
        </div>
      </div>

      {/* QR Code and Instructions - Always visible (portrait) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex justify-center items-start">
            <QRCode
              data={INSTAGRAM_DM_URL}
              size={380}
              margin={12}
              alt="QR Code para Instagram DM"
              className="!border-0 !bg-transparent"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
              <ol className="space-y-4 text-base text-gray-300">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-sm">1</span>
                  <span className="pt-0.5">📥 QR y envía el código de partida por Instagram DM para unirte.</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-sm">2</span>
                  <span className="pt-0.5">🎟️ Recibe tu pareja asignada y tu código de validación. </span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-sm">3</span>
                  <span className="pt-0.5">👥 Encuentra a tu pareja físicamente.</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.4)] flex items-center justify-center font-semibold text-neonMagenta text-sm">4</span>
                  <span className="pt-0.5">🏆 Cuando os encontréis, validad juntos vuestros códigos.</span>
                </li>
              </ol>
            </div>
        </div>

      {/* Validator - Only show when idle or invalid */}
      {(gameState === 'idle' || gameState === 'invalid') && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-textMain">Validador de Parejas</h3>
          
          {error && gameState === 'invalid' && showInvalidMessage && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">
              {error}
            </div>
          )}

          {/* Code Input Fields - Side by side */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="code1" className="block text-base font-medium text-gray-300 mb-2">
                Código del Jugador 1
              </label>
              <input
                id="code1"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                value={code1}
                onChange={(e) => handleCodeChange(e.target.value, setCode1)}
                className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="code2" className="block text-base font-medium text-gray-300 mb-2">
                Código del Jugador 2
              </label>
              <input
                id="code2"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                value={code2}
                onChange={(e) => handleCodeChange(e.target.value, setCode2)}
                className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Validation Button */}
          <button
            onClick={validateCodes}
            disabled={code1.length !== 4 || code2.length !== 4}
            className="w-full p-5 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validar Códigos
            </div>
          </button>
        </div>
      )}

      {/* Validating State */}
      {gameState === 'validating' && (
        <div className="text-center py-10">
          <div className="flex items-center justify-center gap-4">
            <svg className="w-8 h-8 animate-spin text-neonMagenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-2xl font-semibold text-neonMagenta">Validando códigos...</p>
          </div>
        </div>
      )}

      {/* Winning Animation - Show when validated successfully */}
      {gameState === 'valid' && validationResult?.valid && validationResult.players && validationResult.players.length === 2 && (
        <div className={`animate-fade-in ${!showJoinBlock ? 'flex-1 flex flex-col min-h-0 justify-center' : ''}`}>
          {/* Player 1 | Success Message | Player 2 - All in one row */}
          <div className={`grid grid-cols-3 gap-4 items-center ${!showJoinBlock ? 'gap-6' : ''}`}>
            {/* Player 1 */}
            <div className="flex flex-col items-center space-y-3 animate-scale-in">
              {(() => {
                const player = validationResult.players[0]
                const imgUrl = player.characterImageUrl || null
                return (
                  <>
                    <div className={`aspect-square w-full rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg ${showJoinBlock ? 'max-w-[180px]' : 'max-w-[min(320px,90vw)]'}`}>
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
                        <p className={showJoinBlock ? 'text-base font-semibold text-neonMagenta' : 'text-xl font-semibold text-neonMagenta'}>{player.instagramUsername}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Success Message - Middle: only "¡Pareja Válida!" and back button below */}
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <span className={showJoinBlock ? 'text-2xl font-semibold text-green-400' : 'text-3xl font-semibold text-green-400'}>¡Pareja Válida!</span>
              {!showJoinBlock && (
                <BackButton onClick={handleReset} aria-label="Validar otra pareja" />
              )}
            </div>

            {/* Player 2 */}
            <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              {(() => {
                const player = validationResult.players[1]
                const imgUrl = player.characterImageUrl || null
                return (
                  <>
                    <div className={`aspect-square w-full rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg ${showJoinBlock ? 'max-w-[180px]' : 'max-w-[min(320px,90vw)]'}`}>
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
                        <p className={showJoinBlock ? 'text-base font-semibold text-neonMagenta' : 'text-xl font-semibold text-neonMagenta'}>{player.instagramUsername}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Invalid Result - Show error message only for 3 seconds */}
      {gameState === 'invalid' && validationResult && !validationResult.valid && showInvalidMessage && (
        <div className="p-5 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-xl font-semibold text-red-400">Pareja Inválida</span>
          </div>
          {(validationResult.message || error) && (
            <p className="text-base text-red-300">{validationResult.message || error}</p>
          )}
        </div>
      )}
    </div>
    </div>
  )
}

