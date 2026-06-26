import { useEffect, useState } from 'react'
import type { GameScreenProps } from '../../core/types'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import BackButton from '../../core/widgets/BackButton'
import { api } from '../../api/api'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'

type GameState = 'idle' | 'validating' | 'valid' | 'invalid' | 'finished'

type CupidoStats = {
  maleCount?: number
  femaleCount?: number
  matchedCouples?: number
}

type ValidationResponse = {
  valid: boolean
  gameId: string
  pairId: string | null
  players: Array<{
    playerId: number
    instagramUsername: string
    characterId?: number
    characterName?: string
    characterImageUrl?: string | null
  }>
  message: string
  notified?: boolean
}

const CUPIDO_PRIMARY = '#E11D48'
const CUPIDO_PRIMARY_RGB = '225, 29, 72'

export default function CupidoGameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement, onAvatarStateChange }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [code1, setCode1] = useState('')
  const [code2, setCode2] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats] = useState<CupidoStats>({ maleCount: 0, femaleCount: 0, matchedCouples: 0 })
  const [statsLoading] = useState(false)

  // Stats will come from GET /v1/game (gameName) when backend returns them in the game payload
  const handleCodeChange = (value: string, setter: (value: string) => void) => {
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
        codes: [code1, code2],
      })
      setValidationResult(result)
      setGameState(result.valid ? 'valid' : 'invalid')
    } catch (err: any) {
      setError(err.message || 'Error al validar los códigos')
      setGameState('invalid')
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setCode1('')
    setCode2('')
    setValidationResult(null)
    setError(null)
  }

  const matchedCouples = stats.matchedCouples ?? 0
  const maleCount = stats.maleCount ?? 0
  const femaleCount = stats.femaleCount ?? 0

  const showJoinBlock = gameState !== 'valid'

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  const avatarState = gameState === 'valid' ? 'win' : gameState === 'invalid' ? 'lose' : gameState

  useEffect(() => {
    onAvatarStateChange?.(avatarState)
  }, [avatarState, onAvatarStateChange])
  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} logoElement={logoElement} playersElement={playersElement}>
          <LandscapeInfoInstruction>
            Escanea el QR y pulsa JUGAR. Responde al quiz.
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            Cupido te empareja con alguien afín.
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            Encuentra a tu pareja y validad códigos aquí.
          </LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>
        <div className={GAME_LANDSCAPE_CENTER_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.08)`, borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)` }}>
            {statsLoading ? <span className="text-base text-gray-500">Cargando…</span> : (<><div className="flex items-center gap-2"><span className="text-xl" aria-hidden>👨</span><span className="text-base text-gray-400">Chicos</span><span className="text-lg font-semibold text-textMain">{maleCount}</span></div><div className="flex items-center gap-2"><span className="text-xl" aria-hidden>👩</span><span className="text-base text-gray-400">Chicas</span><span className="text-lg font-semibold text-textMain">{femaleCount}</span></div></>)}
            <div className="flex items-center gap-2"><span className="text-base text-gray-400">Parejas emparejadas</span><span className="text-lg font-semibold" style={{ color: CUPIDO_PRIMARY }}>{statsLoading ? '—' : matchedCouples} ❤️</span></div>
          </div>
          {(gameState === 'idle' || gameState === 'invalid') && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-textMain">Validador de Parejas</h3>
              {error && gameState === 'invalid' && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="cupido-code1" className="block text-sm font-medium text-gray-300 mb-2">Código Jugador 1</label><input id="cupido-code1" type="number" inputMode="numeric" min={1000} max={9999} value={code1} placeholder={CODE_INPUT_PLACEHOLDER} aria-label="Código del jugador 1" onChange={(e) => handleCodeChange(e.target.value, setCode1)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
                <div><label htmlFor="cupido-code2" className="block text-sm font-medium text-gray-300 mb-2">Código Jugador 2</label><input id="cupido-code2" type="number" inputMode="numeric" min={1000} max={9999} value={code2} placeholder={CODE_INPUT_PLACEHOLDER} aria-label="Código del jugador 2" onChange={(e) => handleCodeChange(e.target.value, setCode2)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
              </div>
              <button type="button" onClick={validateCodes} disabled={code1.length !== 4 || code2.length !== 4} className="w-full p-5 rounded-xl border font-semibold text-sm transition-colors hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`, borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.3)` }}><div className="flex items-center justify-center gap-3"><svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{VALIDATE_LABEL}</div></button>
            </div>
          )}
          {gameState === 'validating' && <div className="text-center py-10"><div className="flex items-center justify-center gap-4"><svg className="w-8 h-8 animate-spin" style={{ color: CUPIDO_PRIMARY }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg><p className="text-2xl font-semibold" style={{ color: CUPIDO_PRIMARY }}>Validando códigos...</p></div></div>}
          {gameState === 'valid' && validationResult?.valid && validationResult.players?.length === 2 && (
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="flex flex-col items-center space-y-3">{(() => { const player = validationResult.players[0]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 flex items-center justify-center shadow-lg" style={{ borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}>{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 1'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Jugador 1</div>}</div>{player.instagramUsername && <p className="text-base font-semibold" style={{ color: CUPIDO_PRIMARY }}>{player.instagramUsername}</p>}</>); })()}</div>
              <div className="flex flex-col items-center justify-center text-center"><div className="flex items-center gap-1 text-4xl" aria-hidden><span>❤️</span><span>🏹</span><span>❤️</span></div><span className="text-xl font-semibold text-green-400">¡Pareja válida!</span>{validationResult.message && <p className="text-sm text-green-300">{validationResult.message}</p>}</div>
              <div className="flex flex-col items-center space-y-3">{(() => { const player = validationResult.players[1]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 flex items-center justify-center shadow-lg" style={{ borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}>{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 2'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Jugador 2</div>}</div>{player.instagramUsername && <p className="text-base font-semibold" style={{ color: CUPIDO_PRIMARY }}>{player.instagramUsername}</p>}</>); })()}</div>
            </div>
          )}
          {gameState === 'invalid' && validationResult && !validationResult.valid && <div className="p-5 rounded-xl bg-red-500/20 border border-red-500/30 text-center"><span className="text-4xl" aria-hidden>💔</span><span className="text-base font-semibold text-red-400">Pareja inválida</span>{(validationResult.message || error) && <p className="text-sm text-red-300 mt-2">{validationResult.message || error}</p>}</div>}
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
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
      {!showJoinBlock && (
        <div className="flex justify-end mb-2 flex-shrink-0">
          <BackButton onClick={handleReset} aria-label="Validar otra pareja" />
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border"
        style={{
          backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.08)`,
          borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {statsLoading ? (
            <span className="text-sm text-gray-500">Cargando…</span>
          ) : (
            <>
              <div className="flex items-center gap-2" title="Chicos">
                <span className="text-xl" aria-hidden>👨</span>
                <span className="text-sm text-gray-400">Chicos</span>
                <span className="text-lg font-semibold text-textMain">{maleCount}</span>
              </div>
              <div className="flex items-center gap-2" title="Chicas">
                <span className="text-xl" aria-hidden>👩</span>
                <span className="text-sm text-gray-400">Chicas</span>
                <span className="text-lg font-semibold text-textMain">{femaleCount}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Parejas emparejadas</span>
          <span className="text-lg font-semibold" style={{ color: CUPIDO_PRIMARY }}>
            {statsLoading ? '—' : matchedCouples} ❤️
          </span>
        </div>
      </div>

      {/* Validator: double code (like empareja2) */}
      {(gameState === 'idle' || gameState === 'invalid') && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-textMain">Validador de Parejas</h3>
          {error && gameState === 'invalid' && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cupido-code1" className="block text-base font-medium text-gray-300 mb-2">
                Código Jugador 1
              </label>
              <input
                id="cupido-code1"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                value={code1}
                placeholder={CODE_INPUT_PLACEHOLDER}
                aria-label="Código del jugador 1"
                onChange={(e) => handleCodeChange(e.target.value, setCode1)}
                className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="cupido-code2" className="block text-base font-medium text-gray-300 mb-2">
                Código Jugador 2
              </label>
              <input
                id="cupido-code2"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                value={code2}
                placeholder={CODE_INPUT_PLACEHOLDER}
                aria-label="Código del jugador 2"
                onChange={(e) => handleCodeChange(e.target.value, setCode2)}
                className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={validateCodes}
            disabled={code1.length !== 4 || code2.length !== 4}
            className="w-full p-5 rounded-xl border font-semibold text-lg transition-colors hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`,
              borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.3)`,
            }}
            onMouseOver={(e) => {
              if (code1.length === 4 && code2.length === 4) {
                e.currentTarget.style.backgroundColor = `rgba(${CUPIDO_PRIMARY_RGB}, 0.3)`
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {VALIDATE_LABEL}
            </div>
          </button>
        </div>
      )}

      {gameState === 'validating' && (
        <div className="text-center py-10">
          <div className="flex items-center justify-center gap-4">
            <svg
              className="w-8 h-8 animate-spin"
              style={{ color: CUPIDO_PRIMARY }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-2xl font-semibold" style={{ color: CUPIDO_PRIMARY }}>
              Validando códigos...
            </p>
          </div>
        </div>
      )}

      {gameState === 'valid' && validationResult?.valid && validationResult.players?.length === 2 && (
        <div className={`animate-fade-in ${!showJoinBlock ? 'flex-1 flex flex-col min-h-0 justify-center' : ''}`}>
          <div className={`grid grid-cols-3 gap-4 items-center ${!showJoinBlock ? 'gap-6' : ''}`}>
            <div className="flex flex-col items-center space-y-3 animate-scale-in">
              {(() => {
                const player = validationResult.players[0]
                const imgUrl = player.characterImageUrl ?? null
                return (
                  <>
                    <div
                      className={`aspect-square w-full rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 flex items-center justify-center shadow-lg ${showJoinBlock ? 'max-w-[180px]' : 'max-w-[min(320px,90vw)]'}`}
                      style={{ borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}
                    >
                      {imgUrl ? (
                        <img src={imgUrl} alt={player.characterName || 'Jugador 1'} className="max-w-full max-h-full w-auto h-auto object-contain" />
                      ) : (
                        <div className="text-xs text-gray-500">Jugador 1</div>
                      )}
                    </div>
                    {player.instagramUsername && (
                      <p className={`font-semibold ${showJoinBlock ? 'text-base' : 'text-xl'}`} style={{ color: CUPIDO_PRIMARY }}>
                        {player.instagramUsername}
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <div className="flex items-center justify-center gap-1 text-4xl animate-scale-in" aria-hidden>
                <span>❤️</span>
                <span>🏹</span>
                <span>❤️</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className={showJoinBlock ? 'text-xl font-semibold text-green-400' : 'text-2xl font-semibold text-green-400'}>¡Pareja válida!</span>
              </div>
              {validationResult.message && <p className={showJoinBlock ? 'text-sm text-green-300' : 'text-lg text-green-300'}>{validationResult.message}</p>}
            </div>
            <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              {(() => {
                const player = validationResult.players[1]
                const imgUrl = player.characterImageUrl ?? null
                return (
                  <>
                    <div
                      className={`aspect-square w-full rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 flex items-center justify-center shadow-lg ${showJoinBlock ? 'max-w-[180px]' : 'max-w-[min(320px,90vw)]'}`}
                      style={{ borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}
                    >
                      {imgUrl ? (
                        <img src={imgUrl} alt={player.characterName || 'Jugador 2'} className="max-w-full max-h-full w-auto h-auto object-contain" />
                      ) : (
                        <div className="text-xs text-gray-500">Jugador 2</div>
                      )}
                    </div>
                    {player.instagramUsername && (
                      <p className={`font-semibold ${showJoinBlock ? 'text-base' : 'text-xl'}`} style={{ color: CUPIDO_PRIMARY }}>
                        {player.instagramUsername}
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {gameState === 'invalid' && validationResult && !validationResult.valid && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-4xl" aria-hidden>💔</span>
            <span className="text-lg font-semibold text-red-400">Pareja inválida</span>
          </div>
          {(validationResult.message || error) && (
            <p className="text-sm text-red-300">{validationResult.message || error}</p>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
