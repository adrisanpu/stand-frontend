import { useState } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'
import BackButton from '../../core/BackButton'
import { getInstagramDmUrl } from '../../core/instagram'
import { api } from '../../api/api'

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

export default function CupidoGameScreen({ gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
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
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-semibold text-[10px] text-white" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`, border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}>1</span><span className="pt-0.5">📸 Escanea el QR y pulsa JUGAR. Responde al quiz.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-semibold text-[10px] text-white" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`, border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}>2</span><span className="pt-0.5">❤️ Cupido te empareja con alguien afín.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-semibold text-[10px] text-white" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`, border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)` }}>3</span><span className="pt-0.5">✅ Encuentra a tu pareja y validad códigos aquí.</span></li>
              </ol>
            </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.08)`, borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)` }}>
            {statsLoading ? <span className="text-base text-gray-500">Cargando…</span> : (<><div className="flex items-center gap-2"><span className="text-xl" aria-hidden>👨</span><span className="text-base text-gray-400">Chicos</span><span className="text-lg font-semibold text-textMain">{maleCount}</span></div><div className="flex items-center gap-2"><span className="text-xl" aria-hidden>👩</span><span className="text-base text-gray-400">Chicas</span><span className="text-lg font-semibold text-textMain">{femaleCount}</span></div></>)}
            <div className="flex items-center gap-2"><span className="text-base text-gray-400">Parejas emparejadas</span><span className="text-lg font-semibold" style={{ color: CUPIDO_PRIMARY }}>{statsLoading ? '—' : matchedCouples} ❤️</span></div>
          </div>
          {(gameState === 'idle' || gameState === 'invalid') && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-textMain">Validador de Parejas</h3>
              {error && gameState === 'invalid' && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-5">
                <div><label htmlFor="cupido-code1" className="block text-sm font-medium text-gray-300 mb-2">Código Jugador 1</label><input id="cupido-code1" type="number" inputMode="numeric" min={1000} max={9999} value={code1} onChange={(e) => handleCodeChange(e.target.value, setCode1)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
                <div><label htmlFor="cupido-code2" className="block text-sm font-medium text-gray-300 mb-2">Código Jugador 2</label><input id="cupido-code2" type="number" inputMode="numeric" min={1000} max={9999} value={code2} onChange={(e) => handleCodeChange(e.target.value, setCode2)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" /></div>
              </div>
              <button onClick={validateCodes} disabled={code1.length !== 4 || code2.length !== 4} className="w-full p-5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`, borderColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.3)` }}><div className="flex items-center justify-center gap-3"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Validar Códigos</div></button>
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
    <div className={`w-full flex flex-col ${!showJoinBlock ? 'min-h-[70vh]' : ''}`}>
      {!showJoinBlock && (
        <div className="flex justify-end mb-2">
          <BackButton onClick={handleReset} aria-label="Validar otra pareja" />
        </div>
      )}
      <div className={showJoinBlock ? 'space-y-6' : 'flex flex-col flex-1 min-h-0 space-y-4'}>
      {/* QR and instructions first (no game code block) */}
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
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                  style={{
                    backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`,
                    border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)`,
                  }}
                >
                  1
                </span>
                <span className="pt-0.5">Escanea el QR y pulsa JUGAR en el chat de Instagram. Luego responde al quiz (gustos, aficiones…).</span>
              </li>
              <li className="flex gap-4">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                  style={{
                    backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`,
                    border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)`,
                  }}
                >
                  2
                </span>
                <span className="pt-0.5">Cupido te empareja con alguien de gustos afines (pareja o amigos).</span>
              </li>
              <li className="flex gap-4">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                  style={{
                    backgroundColor: `rgba(${CUPIDO_PRIMARY_RGB}, 0.2)`,
                    border: `1px solid rgba(${CUPIDO_PRIMARY_RGB}, 0.4)`,
                  }}
                >
                  3
                </span>
                <span className="pt-0.5">Encuentra a tu pareja y validad juntos vuestros códigos aquí.</span>
              </li>
            </ol>
          </div>
        </div>

      {/* Bottom: chicos, chicas, parejas emparejadas */}
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
          <div className="grid grid-cols-2 gap-5">
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
                onChange={(e) => handleCodeChange(e.target.value, setCode2)}
                className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={validateCodes}
            disabled={code1.length !== 4 || code2.length !== 4}
            className="w-full p-5 rounded-xl border font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validar Códigos
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
