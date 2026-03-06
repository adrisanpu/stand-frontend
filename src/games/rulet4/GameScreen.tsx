import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'
import BackButton from '../../core/BackButton'
import type { Rulet4Settings, Rulet4PanelConfig } from './GameConfig'
import { api } from '../../api/api'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`

type GameState = 
  | 'idle'       // player code input
  | 'validating' // calling /validate
  | 'ready'      // validated, ready to spin
  | 'spinning'   // roulette animation in progress
  | 'result'     // showing selected panel
  | 'finished'   // optional; auto-reset logic

export default function Rulet4GameScreen({ gameName, gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [playerCode, setPlayerCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winningPanel, setWinningPanel] = useState<Rulet4PanelConfig | null>(null)
  const [winningIndex, setWinningIndex] = useState<number | null>(null)
  const [settings, setSettings] = useState<Rulet4Settings | null>(null)
  const wheelRef = useRef<SVGSVGElement>(null)
  const hasSpunRef = useRef(false)

  // Load settings from localStorage
  useEffect(() => {
    if (gameId) {
      const storageKey = `rulet4_settings_${gameId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          setSettings(JSON.parse(saved))
        } catch {
          // Use default settings
          setSettings({ panels: [
            { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
            { id: '2', label: 'Negro', color: '#000000', count: 4 },
            { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
          ]})
        }
      } else {
        // Use default settings
        setSettings({ panels: [
          { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
          { id: '2', label: 'Negro', color: '#000000', count: 4 },
          { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
        ]})
      }
    }
  }, [gameId])

  const handleValidate = async () => {
    if (!playerCode.trim() || !gameId) {
      setError('Por favor ingresa tu código de jugador')
      return
    }

    setIsValidating(true)
    setGameState('validating')
    setError(null)

    try {
      const data = await api.post<{ valid: boolean; playerId?: string; username?: string; message?: string; error?: string }>('/v1/game/validate', {
        gameId: gameId,
        codes: [playerCode.toUpperCase()]
      })
      
      if (data.valid && data.playerId) {
        setPlayerId(data.playerId)
        setUsername(data.username || null)
        setError(null)
        hasSpunRef.current = false
        setGameState('ready')
      } else {
        throw new Error(data.message || 'Código inválido')
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar el código')
      setGameState('idle')
    } finally {
      setIsValidating(false)
    }
  }

  const handleSpin = () => {
    if (segments.length === 0) {
      setError('La ruleta no tiene paneles configurados')
      return
    }

    // Randomly select winning segment from the already randomized segments array
    const randomIndex = Math.floor(Math.random() * segments.length)
    const selectedPanel = segments[randomIndex]
    setWinningPanel(selectedPanel)
    setWinningIndex(randomIndex)

    // Calculate rotation using the segments from state
    const totalSegments = segments.length
    const segmentAngle = 360 / totalSegments
    const spins = 5 // full spins
    const baseRotation = spins * 360
    // Align selected segment to top (12 o'clock)
    // In SVG, -90 degrees is at the top (12 o'clock)
    // Segment center angle in visual coordinates (0 at top): randomIndex * segmentAngle + segmentAngle / 2
    // To align to top, we need to rotate backwards by this amount
    const segmentCenterAngle = randomIndex * segmentAngle + segmentAngle / 2
    // Rotate backwards to align center with top, then add spins
    // The negative sign rotates backwards, aligning the segment center to the top marker
    const targetRotation = baseRotation - segmentCenterAngle

    setGameState('spinning')
    setRotation(0)

    // Animate rotation
    requestAnimationFrame(() => {
      setRotation(targetRotation)
    })

    // After animation completes (3 seconds), show result
    setTimeout(() => {
      setGameState('result')
      hasSpunRef.current = true
      
      // Submit score immediately
      if (playerId && gameId) {
        submitScore(selectedPanel, randomIndex)
      }
    }, 3000)
  }

  const submitScore = async (panel: Rulet4PanelConfig, index: number) => {
    if (!playerId || !gameId) {
      console.error('Missing playerId or gameId')
      return
    }

    try {
      await api.post('/v1/game/score', {
        gameId: gameId,
        playerId: playerId,
        prize: panel.label,
        index: index,
      })
    } catch (err: any) {
      console.error('Error submitting score:', err)
      // Don't show error to user, just log it
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setPlayerCode('')
    setPlayerId(null)
    setUsername(null)
    setError(null)
    setRotation(0)
    setWinningPanel(null)
    setWinningIndex(null)
    hasSpunRef.current = false
  }

  // Build segments array from settings with random order (memoized)
  const [segments, setSegments] = useState<Rulet4PanelConfig[]>([])
  
  useEffect(() => {
    if (settings) {
      const panels = settings.panels
      const allSegments: Rulet4PanelConfig[] = []
      // If we have exactly two panel types with the same count, interleave them then append the rest
      const maxCount = Math.max(...panels.map(p => p.count), 0)
      const withMaxCount = panels.filter(p => p.count === maxCount)
      if (withMaxCount.length === 2 && maxCount >= 2) {
        const [a, b] = withMaxCount
        const rest = panels.filter(p => p !== a && p !== b)
        for (let i = 0; i < maxCount; i++) {
          allSegments.push(a)
          allSegments.push(b)
        }
        rest.forEach(panel => {
          for (let i = 0; i < panel.count; i++) allSegments.push(panel)
        })
      } else {
        panels.forEach(panel => {
          for (let i = 0; i < panel.count; i++) allSegments.push(panel)
        })
        // Shuffle the segments randomly (Fisher-Yates shuffle)
        for (let i = allSegments.length - 1; i > 0; i--) {
          const j: number = Math.floor(Math.random() * (i + 1))
          const tmp = allSegments[j]
          allSegments[j] = allSegments[i]
          allSegments[i] = tmp
        }
      }
      setSegments(allSegments)
    }
  }, [settings])

  const totalSegments = segments.length
  const segmentAngle = totalSegments > 0 ? 360 / totalSegments : 0

  const showJoinBlock = !(['ready', 'spinning', 'result'] as GameState[]).includes(gameState)

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null

  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_200px] gap-4 sm:gap-6 items-stretch h-full min-h-0">
        <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0">
          {logoElement}
          <div className="text-center">
            <div className="p-3 rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)]">
              <p className="text-xs text-gray-300 mb-1">Código de partida {gameName}:</p>
              <p className="text-xl font-bold tracking-wider text-[#FACC15]">{gameId}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <div className="flex justify-center flex-shrink-0">
              <QRCode data={INSTAGRAM_DM_URL} size={260} margin={8} alt="QR Code para Instagram DM" />
            </div>
            <div className="space-y-1.5 min-h-0">
              <h3 className="text-sm font-semibold text-textMain mb-1">Instrucciones</h3>
              <ol className="space-y-1.5 text-xs text-gray-300">
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-[10px]">1</span><span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-[10px]">2</span><span className="pt-0.5">Envía o usa el código de partida, obtén tu código de jugador.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-[10px]">3</span><span className="pt-0.5">Ingresa y valida tu código.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-[10px]">4</span><span className="pt-0.5">Tienes una tirada de la ruleta.</span></li>
              </ol>
            </div>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
          {/* Validation + messages + wheel - same as portrait flow */}
          <div className="space-y-4 min-h-[140px]">
            {gameState === 'idle' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="player-code-landscape" className="text-sm text-gray-300">Tu código de jugador</label>
                  <div className="flex gap-3">
                    <input
                      id="player-code-landscape"
                      type="text"
                      value={playerCode}
                      onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                      placeholder="Ingresa tu código"
                      className="flex-1 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20 uppercase"
                      onKeyPress={(e) => { if (e.key === 'Enter') handleValidate() }}
                    />
                    <button
                      onClick={handleValidate}
                      disabled={!playerCode.trim() || isValidating}
                      className="px-8 h-14 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                    >
                      {isValidating ? 'Validando...' : 'Validar'}
                    </button>
                  </div>
                </div>
                {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
              </>
            )}
            {gameState === 'validating' && (
              <div className="flex items-center justify-center py-10">
                <div className="flex items-center justify-center gap-4">
                  <svg className="w-8 h-8 animate-spin text-[#FACC15]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-2xl font-semibold text-[#FACC15]">Validando código...</p>
                </div>
              </div>
            )}
            {gameState === 'ready' && (
              <div className="p-8 rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center">
                <div className="text-3xl font-bold text-[#FACC15] mb-2">¡Bienvenido{username ? `, ${username}` : ''}!</div>
                <div className="text-xl text-gray-300">Estás listo para girar la ruleta</div>
              </div>
            )}
            {gameState === 'spinning' && (
              <div className="p-8 rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center">
                <div className="text-3xl font-bold text-[#FACC15] mb-2">¡Bienvenido{username ? `, ${username}` : ''}!</div>
                <div className="text-xl text-gray-300 animate-pulse">Girando...</div>
              </div>
            )}
            {gameState === 'result' && winningPanel && (
              <div className="p-8 rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center">
                <div className="text-3xl font-bold text-[#FACC15] mb-2">{username ? `${username}, ` : ''}¡Has ganado!</div>
                <div className="text-4xl font-bold text-white">{winningPanel.label}</div>
              </div>
            )}
          </div>
          {segments.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative z-10 mb-2">
                  <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[28px] border-t-[#FACC15]"></div>
                </div>
                <div className="relative w-[min(520px,85vw)] h-[min(520px,85vw)] max-w-[520px] max-h-[520px]">
                  <svg
                    ref={wheelRef}
                    width="100%"
                    height="100%"
                    viewBox="0 0 400 400"
                    className="absolute inset-0"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: gameState === 'spinning' ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                      opacity: (gameState === 'idle' || gameState === 'validating') ? 0.5 : 1,
                    }}
                  >
                    <circle cx="200" cy="200" r="200" fill="transparent" stroke="rgba(250,204,21,0.3)" strokeWidth="4" />
                    {segments.map((segment, index) => {
                      const startAngle = (index * segmentAngle - 90) * Math.PI / 180
                      const endAngle = ((index + 1) * segmentAngle - 90) * Math.PI / 180
                      const isWinning = gameState === 'result' && winningIndex === index
                      const centerX = 200, centerY = 200, radius = 200
                      const x1 = centerX + radius * Math.cos(startAngle)
                      const y1 = centerY + radius * Math.sin(startAngle)
                      const x2 = centerX + radius * Math.cos(endAngle)
                      const y2 = centerY + radius * Math.sin(endAngle)
                      const largeArcFlag = segmentAngle > 180 ? 1 : 0
                      const pathData = [`M ${centerX} ${centerY}`, `L ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
                      const textAngle = (startAngle + endAngle) / 2
                      const textRadius = radius * 0.7
                      const textX = centerX + textRadius * Math.cos(textAngle)
                      const textY = centerY + textRadius * Math.sin(textAngle)
                      return (
                        <g key={`${segment.id}-${index}`}>
                          <path d={pathData} fill={segment.color || '#DC2626'} stroke={isWinning ? '#FACC15' : 'rgba(255,255,255,0.2)'} strokeWidth={isWinning ? 4 : 1} style={{ filter: isWinning ? 'drop-shadow(0 0 10px rgba(250,204,21,0.8))' : 'none' }} />
                          <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20" fontWeight="600" className="pointer-events-none select-none" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }} transform={`rotate(${(textAngle * 180 / Math.PI) + 90} ${textX} ${textY})`}>{segment.label}</text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <button onClick={handleSpin} disabled={gameState !== 'ready' || hasSpunRef.current} className="px-10 py-5 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-2xl">GIRAR RULETA</button>
                {gameState === 'idle' && <p className="text-base text-gray-400 mt-2">Valida tu código para activar la ruleta</p>}
              </div>
            </div>
          )}
        </div>
        <div className="card flex flex-col gap-3 p-4 min-w-0 min-h-0 overflow-hidden items-start">
          {sidebarElement}
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
      {/* Game Code - Always visible */}
      <div className="text-center flex-shrink-0">
        <div className="p-5 rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)]">
          <p className="text-base text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-4xl lg:text-5xl font-bold tracking-wider text-[#FACC15]">{gameId}</p>
        </div>
      </div>

      {/* QR Code and Instructions - Always visible (portrait) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* QR Code - Left column */}
          <div className="flex justify-center items-start">
            <QRCode 
              data={INSTAGRAM_DM_URL}
              size={380}
              margin={12}
              alt="QR Code para Instagram DM"
            />
          </div>

          {/* Instructions - Right column */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
            <ol className="space-y-4 text-base text-gray-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-sm">1</span>
                <span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-sm">2</span>
                <span className="pt-0.5">Envía o usa el código de partida, obtén tu código de jugador.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-sm">3</span>
                <span className="pt-0.5">Ingresa y valida tu código.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.4)] flex items-center justify-center font-semibold text-[#FACC15] text-sm">4</span>
                <span className="pt-0.5">Tienes una tirada de la ruleta.</span>
              </li>
            </ol>
          </div>
        </div>

      {/* Player Code Input / Welcome Message / Prize - Same space, consistent height */}
      <div className={showJoinBlock ? 'space-y-4 min-h-[140px]' : 'flex-1 flex flex-col min-h-0 space-y-4'}>
        {gameState === 'idle' && (
          <>
            <div className="space-y-2">
              <label htmlFor="player-code" className="text-base text-gray-300">Tu código de jugador</label>
              <div className="flex gap-3">
                <input
                  id="player-code"
                  type="text"
                  value={playerCode}
                  onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                  placeholder="Ingresa tu código"
                  className="flex-1 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20 uppercase"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleValidate()
                    }
                  }}
                />
                <button
                  onClick={handleValidate}
                  disabled={!playerCode.trim() || isValidating}
                  className="px-8 h-14 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                >
                  {isValidating ? 'Validando...' : 'Validar'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">
                {error}
              </div>
            )}
          </>
        )}

        {/* Validating State */}
        {gameState === 'validating' && (
          <div className="flex items-center justify-center py-10">
            <div className="flex items-center justify-center gap-4">
              <svg className="w-8 h-8 animate-spin text-[#FACC15]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-2xl font-semibold text-[#FACC15]">Validando código...</p>
            </div>
          </div>
        )}

        {/* Welcome Message - After validation */}
        {gameState === 'ready' && (
          <div className={`rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center ${showJoinBlock ? 'p-8' : 'p-6 flex-1 flex flex-col justify-center'}`}>
            <div className={showJoinBlock ? 'text-3xl font-bold text-[#FACC15] mb-2' : 'text-4xl font-bold text-[#FACC15] mb-2'}>
              ¡Bienvenido{username ? `, ${username}` : ''}!
            </div>
            <div className={showJoinBlock ? 'text-xl text-gray-300' : 'text-2xl text-gray-300'}>
              Estás listo para girar la ruleta
            </div>
          </div>
        )}

        {/* Spinning State - Show in welcome message box */}
        {gameState === 'spinning' && (
          <div className={`rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center ${showJoinBlock ? 'p-8' : 'p-6 flex-1 flex flex-col justify-center'}`}>
            <div className={showJoinBlock ? 'text-3xl font-bold text-[#FACC15] mb-2' : 'text-4xl font-bold text-[#FACC15] mb-2'}>
              ¡Bienvenido{username ? `, ${username}` : ''}!
            </div>
            <div className={showJoinBlock ? 'text-xl text-gray-300 animate-pulse' : 'text-2xl text-gray-300 animate-pulse'}>
              Girando...
            </div>
          </div>
        )}

        {/* Prize Display - After spin result */}
        {gameState === 'result' && winningPanel && (
          <div className={`rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)] text-center ${showJoinBlock ? 'p-8' : 'p-8 flex-1 flex flex-col justify-center'}`}>
            <div className={showJoinBlock ? 'text-3xl font-bold text-[#FACC15] mb-2' : 'text-4xl font-bold text-[#FACC15] mb-2'}>
              {username ? `${username}, ` : ''}¡Has ganado!
            </div>
            <div className={showJoinBlock ? 'text-4xl font-bold text-white' : 'text-5xl font-bold text-white'}>
              {winningPanel.label}
            </div>
          </div>
        )}
      </div>

      {/* Roulette Wheel - Always visible */}
      {segments.length > 0 && (
        <div className={showJoinBlock ? 'space-y-6' : 'flex-1 flex flex-col min-h-0 space-y-6'}>
          {/* Roulette Container */}
          <div className="flex flex-col items-center flex-1 min-h-0 justify-center">
            {/* Top Marker */}
            <div className="relative z-10 mb-2">
              <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[28px] border-t-[#FACC15]"></div>
            </div>

            {/* Wheel - larger when expanded (portrait) */}
            <div className={`relative ${showJoinBlock ? 'w-[min(520px,85vw)] h-[min(520px,85vw)] max-w-[520px] max-h-[520px]' : 'w-[min(600px,90vw)] h-[min(600px,90vw)] max-w-[600px] max-h-[600px]'}`}>
              <svg
                ref={wheelRef}
                width="100%"
                height="100%"
                viewBox="0 0 400 400"
                className="absolute inset-0"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: gameState === 'spinning' ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  opacity: (gameState === 'idle' || gameState === 'validating') ? 0.5 : 1,
                }}
              >
                <circle cx="200" cy="200" r="200" fill="transparent" stroke="rgba(250,204,21,0.3)" strokeWidth="4" />
                {segments.map((segment, index) => {
                  const startAngle = (index * segmentAngle - 90) * Math.PI / 180
                  const endAngle = ((index + 1) * segmentAngle - 90) * Math.PI / 180
                  const isWinning = gameState === 'result' && winningIndex === index
                  const centerX = 200
                  const centerY = 200
                  const radius = 200

                  // Calculate path for segment
                  const x1 = centerX + radius * Math.cos(startAngle)
                  const y1 = centerY + radius * Math.sin(startAngle)
                  const x2 = centerX + radius * Math.cos(endAngle)
                  const y2 = centerY + radius * Math.sin(endAngle)

                  const largeArcFlag = segmentAngle > 180 ? 1 : 0

                  const pathData = [
                    `M ${centerX} ${centerY}`,
                    `L ${x1} ${y1}`,
                    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                    'Z'
                  ].join(' ')

                  // Text position (middle of segment arc)
                  const textAngle = (startAngle + endAngle) / 2
                  const textRadius = radius * 0.7
                  const textX = centerX + textRadius * Math.cos(textAngle)
                  const textY = centerY + textRadius * Math.sin(textAngle)

                  return (
                    <g key={`${segment.id}-${index}`}>
                      <path
                        d={pathData}
                        fill={segment.color || '#DC2626'}
                        stroke={isWinning ? '#FACC15' : 'rgba(255,255,255,0.2)'}
                        strokeWidth={isWinning ? 4 : 1}
                        style={{
                          filter: isWinning ? 'drop-shadow(0 0 10px rgba(250,204,21,0.8))' : 'none',
                        }}
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="20"
                        fontWeight="600"
                        className="pointer-events-none select-none"
                        style={{
                          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                        }}
                        transform={`rotate(${(textAngle * 180 / Math.PI) + 90} ${textX} ${textY})`}
                      >
                        {segment.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Spin Button - Always visible, but only enabled when validated */}
          <div className="text-center">
            <button
              onClick={handleSpin}
              disabled={gameState !== 'ready' || hasSpunRef.current}
              className="px-10 py-5 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-2xl"
            >
              GIRAR RULETA
            </button>
            {gameState === 'idle' && (
              <p className="text-base text-gray-400 mt-2">Valida tu código para activar la ruleta</p>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

