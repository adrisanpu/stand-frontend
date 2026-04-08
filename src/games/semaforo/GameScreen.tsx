import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/widgets/QRCode'
import BackButton from '../../core/widgets/BackButton'
import { getInstagramDmUrl } from '../../core/lib/instagram'
import { api } from '../../api/api'

const CROSS_QUIZ_QUESTION_COUNT = 3
const CROSS_QUIZ_TIME_SEC = 5
const CROSS_QUIZ_MAX_STRIKES = 3
const CROSS_QUIZ_RESULT_DURATION_MS = 1500
const VALID_TO_CROSS_QUIZ_DELAY_MS = 2000

type GameState = 'idle' | 'validating' | 'valid' | 'invalid' | 'cross_quiz' | 'cross_quiz_result' | 'cross_quiz_win' | 'cross_quiz_lose'

type SemaforoStats = {
  redCount?: number
  yellowCount?: number
  greenCount?: number
}

type QuizOption = { title: string; payload: string }
type QuizQuestion = { text: string; options: QuizOption[] }
type QuizQuestions = Record<string, QuizQuestion>

type SemaforoPlayerType = {
  SEMAFORO?: {
    quizAnswers?: Record<string, string>
    [key: string]: unknown
  }
  [key: string]: unknown
}

type ValidationResponse = {
  valid: boolean
  gameId: string
  pairId?: string | null
  reason?: string
  message?: string
  game?: {
    gameId: string
    quizOrder?: string[]
    quizQuestions?: QuizQuestions
    [key: string]: unknown
  }
  players: Array<{
    playerId: number
    instagramUsername: string
    type?: SemaforoPlayerType
    characterId?: number
    characterName?: string
    characterImageUrl?: string | null
  }>
  notified?: boolean
}

type CrossQuizRound = { questionId: string; guesserIndex: number; targetIndex: number }

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildCrossQuizRounds(res: ValidationResponse): CrossQuizRound[] {
  const game = res.game
  const order = game?.quizOrder
  const players = res.players
  if (!order || !players?.length || players.length < 2) return []
  const p0 = players[0].type?.SEMAFORO?.quizAnswers
  const p1 = players[1].type?.SEMAFORO?.quizAnswers
  if (!p0 || !p1) return []
  const questionIds = order.filter((id) => id !== 'q1').slice(0, CROSS_QUIZ_QUESTION_COUNT)
  const rounds: CrossQuizRound[] = []
  for (const qId of questionIds) {
    rounds.push({ questionId: qId, guesserIndex: 0, targetIndex: 1 })
    rounds.push({ questionId: qId, guesserIndex: 1, targetIndex: 0 })
  }
  return shuffleArray(rounds)
}

export default function SemaforoGameScreen({ gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [stats] = useState<SemaforoStats>({ redCount: 0, yellowCount: 0, greenCount: 0 })
  const [statsLoading] = useState(false)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [code1, setCode1] = useState('')
  const [code2, setCode2] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [crossQuizRounds, setCrossQuizRounds] = useState<CrossQuizRound[]>([])
  const [crossQuizRoundIndex, setCrossQuizRoundIndex] = useState(0)
  const [crossQuizTimeLeft, setCrossQuizTimeLeft] = useState(CROSS_QUIZ_TIME_SEC)
  const [crossQuizSelected, setCrossQuizSelected] = useState<string | null>(null)
  const [crossQuizResult, setCrossQuizResult] = useState<'correct' | 'wrong' | null>(null)
  const [crossQuizStrikes, setCrossQuizStrikes] = useState(0)
  const crossQuizStrikesRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const resultTimeoutRef = useRef<number | null>(null)
  const timeoutHandledRef = useRef(false)

  // Stats will come from GET /v1/game (gameName) when backend returns them in the game payload
  const handleCodeChange = (value: string, setter: (v: string) => void) => {
    setter(value.replace(/\D/g, '').slice(0, 4))
  }

  const validateCodes = async () => {
    if (!code1 || !code2 || code1.length !== 4 || code2.length !== 4) {
      setError('Ambos códigos deben tener 4 dígitos')
      return
    }
    if (!gameId) return
    setGameState('validating')
    setError(null)
    setValidationResult(null)

    try {
      const result = await api.post<ValidationResponse>('/v1/game/validate', { gameId, codes: [code1, code2] })
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
    setCrossQuizRounds([])
    setCrossQuizRoundIndex(0)
    setCrossQuizTimeLeft(CROSS_QUIZ_TIME_SEC)
    setCrossQuizSelected(null)
    setCrossQuizResult(null)
    setCrossQuizStrikes(0)
    crossQuizStrikesRef.current = 0
    if (timerRef.current) clearInterval(timerRef.current)
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
  }

  // After valid: if we have quiz data, start cross-quiz after delay; else do not auto-reset
  useEffect(() => {
    if (gameState !== 'valid' || !validationResult?.valid || !validationResult.players?.length) return
    const rounds = buildCrossQuizRounds(validationResult)
    if (rounds.length > 0) {
      timeoutHandledRef.current = false
      const t = setTimeout(() => {
        setCrossQuizRounds(rounds)
        setCrossQuizRoundIndex(0)
        setCrossQuizTimeLeft(CROSS_QUIZ_TIME_SEC)
        setCrossQuizSelected(null)
        setCrossQuizResult(null)
        setCrossQuizStrikes(0)
        crossQuizStrikesRef.current = 0
        setGameState('cross_quiz')
      }, VALID_TO_CROSS_QUIZ_DELAY_MS)
      return () => clearTimeout(t)
    }
  }, [gameState, validationResult])

  // Cross-quiz 3s countdown
  useEffect(() => {
    if (gameState !== 'cross_quiz' || crossQuizSelected !== null) return
    timerRef.current = window.setInterval(() => {
      setCrossQuizTimeLeft((prev) => {
        if (prev <= 0.1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return Math.max(0, prev - 0.1)
      })
    }, 100)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState, crossQuizRoundIndex, crossQuizSelected])

  // On timeout (timeLeft 0): treat as wrong = 1 strike (once per round)
  useEffect(() => {
    if (gameState !== 'cross_quiz' || crossQuizSelected !== null || crossQuizTimeLeft > 0 || timeoutHandledRef.current) return
    const round = crossQuizRounds[crossQuizRoundIndex]
    const game = validationResult?.game
    const players = validationResult?.players
    if (!round || !game?.quizQuestions?.[round.questionId] || !players) return
    timeoutHandledRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    crossQuizStrikesRef.current = crossQuizStrikesRef.current + 1
    setCrossQuizStrikes(crossQuizStrikesRef.current)
    setCrossQuizResult('wrong')
    setGameState('cross_quiz_result')
    const nextIndex = crossQuizRoundIndex + 1
    const roundsLength = crossQuizRounds.length
    resultTimeoutRef.current = window.setTimeout(() => {
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      if (crossQuizStrikesRef.current >= CROSS_QUIZ_MAX_STRIKES) {
        setGameState('cross_quiz_lose')
      } else if (nextIndex >= roundsLength) {
        setGameState('cross_quiz_win')
      } else {
        timeoutHandledRef.current = false
        setCrossQuizRoundIndex(nextIndex)
        setCrossQuizTimeLeft(CROSS_QUIZ_TIME_SEC)
        setCrossQuizSelected(null)
        setCrossQuizResult(null)
        setGameState('cross_quiz')
      }
    }, CROSS_QUIZ_RESULT_DURATION_MS)
  }, [gameState, crossQuizTimeLeft, crossQuizSelected, crossQuizRoundIndex, crossQuizRounds, validationResult])

  const handleCrossQuizAnswer = (payload: string) => {
    if (gameState !== 'cross_quiz' || crossQuizSelected !== null) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setCrossQuizSelected(payload)
    const round = crossQuizRounds[crossQuizRoundIndex]
    const game = validationResult?.game
    const players = validationResult?.players
    if (!round || !game?.quizQuestions?.[round.questionId] || !players) return
    const targetAnswers = players[round.targetIndex].type?.SEMAFORO?.quizAnswers
    const answerLetter = targetAnswers?.[round.questionId]
    const correctPayload = `${game.gameId}_${round.questionId}_${answerLetter}`
    const correct = payload === correctPayload
    setCrossQuizResult(correct ? 'correct' : 'wrong')
    if (!correct) {
      crossQuizStrikesRef.current = crossQuizStrikesRef.current + 1
      setCrossQuizStrikes(crossQuizStrikesRef.current)
    }
    setGameState('cross_quiz_result')
    const nextIndex = crossQuizRoundIndex + 1
    resultTimeoutRef.current = window.setTimeout(() => {
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      if (!correct && crossQuizStrikesRef.current >= CROSS_QUIZ_MAX_STRIKES) {
        setGameState('cross_quiz_lose')
      } else if (correct && nextIndex >= crossQuizRounds.length) {
        setGameState('cross_quiz_win')
      } else {
        timeoutHandledRef.current = false
        setCrossQuizRoundIndex(nextIndex)
        setCrossQuizTimeLeft(CROSS_QUIZ_TIME_SEC)
        setCrossQuizSelected(null)
        setCrossQuizResult(null)
        setGameState('cross_quiz')
      }
    }, CROSS_QUIZ_RESULT_DURATION_MS)
  }

  const redCount = stats.redCount ?? 0
  const yellowCount = stats.yellowCount ?? 0
  const greenCount = stats.greenCount ?? 0

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null

  const showJoinBlock = !([
    'valid',
    'cross_quiz',
    'cross_quiz_result',
    'cross_quiz_win',
    'cross_quiz_lose',
  ] as GameState[]).includes(gameState)

  const semaforoMainContent = (
    <>
      <div className="flex flex-wrap items-center justify-center gap-6 p-5 rounded-xl border bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.2)]">
        {statsLoading ? (
          <span className="text-base text-gray-500">Cargando…</span>
        ) : (
          <>
            <div className="flex items-center gap-3" title="Casado">
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#EF4444]" aria-hidden />
              <span className="text-base text-gray-400">Casado</span>
              <span className="text-2xl font-semibold text-textMain">{redCount}</span>
            </div>
            <div className="flex items-center gap-3" title="Puede ser">
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#EAB308]" aria-hidden />
              <span className="text-base text-gray-400">Puede ser</span>
              <span className="text-2xl font-semibold text-textMain">{yellowCount}</span>
            </div>
            <div className="flex items-center gap-3" title="Soltero">
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#22C55E]" aria-hidden />
              <span className="text-base text-gray-400">Soltero</span>
              <span className="text-2xl font-semibold text-textMain">{greenCount}</span>
            </div>
          </>
        )}
      </div>
      {(gameState === 'idle' || gameState === 'invalid') && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-textMain">Validador de Parejas</h3>
          {error && gameState === 'invalid' && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="semaforo-code1" className="block text-base font-medium text-gray-300 mb-2">Código Jugador 1</label>
              <input id="semaforo-code1" type="number" inputMode="numeric" min={1000} max={9999} value={code1} onChange={(e) => handleCodeChange(e.target.value, setCode1)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="semaforo-code2" className="block text-base font-medium text-gray-300 mb-2">Código Jugador 2</label>
              <input id="semaforo-code2" type="number" inputMode="numeric" min={1000} max={9999} value={code2} onChange={(e) => handleCodeChange(e.target.value, setCode2)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" />
            </div>
          </div>
          <button onClick={validateCodes} disabled={code1.length !== 4 || code2.length !== 4} className="w-full p-5 rounded-xl bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.3)] transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Validar Códigos
            </div>
          </button>
        </div>
      )}
      {gameState === 'validating' && (
        <div className="text-center py-10">
          <div className="flex items-center justify-center gap-4">
            <svg className="w-8 h-8 animate-spin text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <p className="text-2xl font-semibold text-green-500">Validando códigos...</p>
          </div>
        </div>
      )}
      {gameState === 'valid' && validationResult?.valid && validationResult.players?.length === 2 && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center space-y-3 animate-scale-in">
              {(() => { const player = validationResult.players[0]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(34,197,94,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 1'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Jugador 1</div>}</div>{player.instagramUsername && <p className="text-base font-semibold text-green-500">{player.instagramUsername}</p>}</>); })()}
            </div>
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <span className="text-xl font-semibold text-green-400">¡Pareja válida!</span>
              {validationResult.message && <p className="text-sm text-green-300">{validationResult.message}</p>}
            </div>
            <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              {(() => { const player = validationResult.players[1]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(34,197,94,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || 'Jugador 2'} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">Jugador 2</div>}</div>{player.instagramUsername && <p className="text-base font-semibold text-green-500">{player.instagramUsername}</p>}</>); })()}
            </div>
          </div>
        </div>
      )}
      {gameState === 'cross_quiz' && validationResult && crossQuizRounds[crossQuizRoundIndex] && (() => {
        const round = crossQuizRounds[crossQuizRoundIndex]
        const game = validationResult.game
        const players = validationResult.players
        const q = game?.quizQuestions?.[round.questionId]
        if (!q || !players) return null
        const guesserName = players[round.guesserIndex].instagramUsername ?? 'Jugador ' + (round.guesserIndex + 1)
        const targetName = players[round.targetIndex].instagramUsername ?? 'Jugador ' + (round.targetIndex + 1)
        return (
          <div className="animate-fade-in p-6 rounded-xl border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] space-y-4 min-h-[320px] flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Pregunta {crossQuizRoundIndex + 1} de {crossQuizRounds.length}</p>
              <p className="flex gap-1 text-xl" title="Vidas">{Array.from({ length: CROSS_QUIZ_MAX_STRIKES }, (_, i) => (<span key={i} aria-hidden className={i < crossQuizStrikes ? 'opacity-25' : 'opacity-100'}>❤️</span>))}</p>
            </div>
            <p className="text-lg font-semibold text-textMain text-center">{guesserName} ¿{q.text} {targetName}?</p>
            <div className="flex justify-center">
              <div className="w-24 h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-green-500 transition-all duration-100" style={{ width: `${(crossQuizTimeLeft / CROSS_QUIZ_TIME_SEC) * 100}%` }} /></div>
              <span className="ml-2 text-lg font-mono text-green-400 tabular-nums">{crossQuizTimeLeft.toFixed(1)}s</span>
            </div>
            <div className="grid gap-2">
              {q.options.map((opt) => (
                <button key={opt.payload} type="button" onClick={() => handleCrossQuizAnswer(opt.payload)} disabled={crossQuizSelected !== null} className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.06)] border border-white/10 hover:bg-[rgba(34,197,94,0.2)] hover:border-[rgba(34,197,94,0.4)] transition-colors text-left font-medium disabled:opacity-70">{opt.title}</button>
              ))}
            </div>
          </div>
        )
      })()}
      {gameState === 'cross_quiz_result' && (
        <div className={`min-h-[320px] p-6 rounded-xl text-center animate-fade-in flex flex-col items-center justify-center ${crossQuizResult === 'correct' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
          {crossQuizResult === 'correct' ? (<><span className="text-4xl" aria-hidden>✅</span><p className="text-xl font-semibold text-green-400 mt-2">¡Correcto!</p></>) : (<><span className="text-4xl" aria-hidden>❌</span><p className="text-xl font-semibold text-red-400 mt-2">Incorrecto</p></>)}
        </div>
      )}
      {gameState === 'cross_quiz_win' && (
        <div className="min-h-[320px] p-6 rounded-xl bg-green-500/20 border border-green-500/30 text-center animate-fade-in flex flex-col items-center justify-center">
          <span className="text-5xl" aria-hidden>🏆</span>
          <p className="text-2xl font-bold text-green-400 mt-2">¡Ganadores!</p>
          <p className="text-lg text-green-300 mt-1">Os conocéis bien</p>
        </div>
      )}
      {gameState === 'cross_quiz_lose' && (
        <div className="min-h-[320px] p-6 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in flex flex-col items-center justify-center">
          <span className="text-5xl" aria-hidden>💔</span>
          <p className="text-2xl font-bold text-red-400 mt-2">No habéis superado el reto</p>
          <p className="text-sm text-red-300 mt-1">3 fallos = partida perdida</p>
        </div>
      )}
      {gameState === 'invalid' && validationResult && !validationResult.valid && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2"><span className="text-4xl" aria-hidden>💔</span><span className="text-lg font-semibold text-red-400">Pareja inválida</span></div>
          {(validationResult.message || error) && <p className="text-sm text-red-300">{validationResult.message || error}</p>}
        </div>
      )}
    </>
  )

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
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-[10px]">1</span><span className="pt-0.5">📸 Escanea el QR y pulsa JUGAR. Responde al quiz.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-[10px]">2</span><span className="pt-0.5">🔴🟡🟢 Te asignamos un grupo (Casado / Puede ser / Soltero).</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-[10px]">3</span><span className="pt-0.5">👥 Aquí ves cuánta gente hay en cada grupo.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-[10px]">4</span><span className="pt-0.5">✅ Validad juntos vuestros códigos aquí.</span></li>
              </ol>
            </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
          {semaforoMainContent}
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
      {/* QR and instructions first (no game code block) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex justify-center items-start">
            <QRCode data={getInstagramDmUrl(gameId)} size={380} margin={12} alt="QR Code para Instagram DM" />
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
            <ol className="space-y-4 text-base text-gray-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-sm">1</span>
                <span className="pt-0.5">Escanea el QR y pulsa JUGAR en el chat de Instagram. Luego responde al quiz (estado sentimental / interés social).</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-sm">2</span>
                <span className="pt-0.5">Te asignamos a un grupo: 🔴 Casado, 🟡 Puede ser, 🟢 Soltero.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-sm">3</span>
                <span className="pt-0.5">Aquí ves cuánta gente hay en cada grupo.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center font-semibold text-green-500 text-sm">4</span>
                <span className="pt-0.5">Cuando os encontréis, validad juntos vuestros códigos aquí.</span>
              </li>
            </ol>
          </div>
        </div>

      {/* Main content - flex-1 when expanded for more space */}
      <div className={showJoinBlock ? '' : 'flex-1 flex flex-col min-h-0'}>
      {semaforoMainContent}
      </div>
    </div>
    </div>
  )
}
