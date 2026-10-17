import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import BackButton from '../../core/widgets/BackButton'
import { api } from '../../api/api'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'

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

export default function SemaforoGameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement, onAvatarStateChange }: GameScreenProps) {
  const { t } = useOperatorLanguage()
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
      setError(t('Ambos códigos deben tener 4 dígitos', 'Both codes must have 4 digits'))
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
      setError(err.message || t('Error al validar los códigos', 'Error validating the codes'))
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
  const avatarState =
    gameState === 'cross_quiz'
      ? 'playing'
      : gameState === 'cross_quiz_result'
        ? 'result'
        : gameState === 'cross_quiz_win' || gameState === 'cross_quiz_lose'
          ? 'finished'
          : gameState === 'valid'
            ? 'ready'
            : gameState === 'invalid'
              ? 'lose'
              : gameState

  useEffect(() => {
    onAvatarStateChange?.(avatarState)
  }, [avatarState, onAvatarStateChange])

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
          <span className="text-base text-gray-500">{t('Cargando…', 'Loading…')}</span>
        ) : (
          <>
            <div className="flex items-center gap-3" title={t('Casado', 'Married')}>
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#EF4444]" aria-hidden />
              <span className="text-base text-gray-400">{t('Casado', 'Married')}</span>
              <span className="text-2xl font-semibold text-textMain">{redCount}</span>
            </div>
            <div className="flex items-center gap-3" title={t('Puede ser', 'Maybe')}>
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#EAB308]" aria-hidden />
              <span className="text-base text-gray-400">{t('Puede ser', 'Maybe')}</span>
              <span className="text-2xl font-semibold text-textMain">{yellowCount}</span>
            </div>
            <div className="flex items-center gap-3" title={t('Soltero', 'Single')}>
              <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0 bg-[#22C55E]" aria-hidden />
              <span className="text-base text-gray-400">{t('Soltero', 'Single')}</span>
              <span className="text-2xl font-semibold text-textMain">{greenCount}</span>
            </div>
          </>
        )}
      </div>
      {(gameState === 'idle' || gameState === 'invalid') && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-textMain">{t('Validador de Parejas', 'Match validator')}</h3>
          {error && gameState === 'invalid' && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">{localizeOperatorMessage(error, t)}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="semaforo-code1" className="block text-base font-medium text-gray-300 mb-2">{t('Código Jugador 1', 'Player 1 code')}</label>
              <input id="semaforo-code1" type="number" inputMode="numeric" min={1000} max={9999} value={code1} placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')} aria-label={t('Código del jugador 1', 'Player 1 code')} onChange={(e) => handleCodeChange(e.target.value, setCode1)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="semaforo-code2" className="block text-base font-medium text-gray-300 mb-2">{t('Código Jugador 2', 'Player 2 code')}</label>
              <input id="semaforo-code2" type="number" inputMode="numeric" min={1000} max={9999} value={code2} placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')} aria-label={t('Código del jugador 2', 'Player 2 code')} onChange={(e) => handleCodeChange(e.target.value, setCode2)} className="w-full h-14 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-lg font-mono focus:border-white/20 focus:outline-none" />
            </div>
          </div>
          <button type="button" onClick={validateCodes} disabled={code1.length !== 4 || code2.length !== 4} className="w-full p-5 rounded-xl bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.3)] transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center justify-center gap-3">
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t(VALIDATE_LABEL, 'Validate')}
            </div>
          </button>
        </div>
      )}
      {gameState === 'validating' && (
        <div className="text-center py-10">
          <div className="flex items-center justify-center gap-4">
            <svg className="w-8 h-8 animate-spin text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <p className="text-2xl font-semibold text-green-500">{t('Validando códigos...', 'Validating codes...')}</p>
          </div>
        </div>
      )}
      {gameState === 'valid' && validationResult?.valid && validationResult.players?.length === 2 && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center space-y-3 animate-scale-in">
              {(() => { const player = validationResult.players[0]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(34,197,94,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || t('Jugador 1', 'Player 1')} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">{t('Jugador 1', 'Player 1')}</div>}</div>{player.instagramUsername && <p className="text-base font-semibold text-green-500">{player.instagramUsername}</p>}</>); })()}
            </div>
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <span className="text-xl font-semibold text-green-400">{t('¡Pareja válida!', 'Valid match!')}</span>
              {validationResult.message && <p className="text-sm text-green-300">{validationResult.message}</p>}
            </div>
            <div className="flex flex-col items-center space-y-3 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              {(() => { const player = validationResult.players[1]; const imgUrl = player.characterImageUrl ?? null; return (<><div className="aspect-square w-full max-w-[180px] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(34,197,94,0.4)] flex items-center justify-center shadow-lg">{imgUrl ? <img src={imgUrl} alt={player.characterName || t('Jugador 2', 'Player 2')} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <div className="text-xs text-gray-500">{t('Jugador 2', 'Player 2')}</div>}</div>{player.instagramUsername && <p className="text-base font-semibold text-green-500">{player.instagramUsername}</p>}</>); })()}
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
        const guesserName = players[round.guesserIndex].instagramUsername ?? t(`Jugador ${round.guesserIndex + 1}`, `Player ${round.guesserIndex + 1}`)
        const targetName = players[round.targetIndex].instagramUsername ?? t(`Jugador ${round.targetIndex + 1}`, `Player ${round.targetIndex + 1}`)
        return (
          <div className="animate-fade-in p-6 rounded-xl border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] space-y-4 min-h-[320px] flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t(`Pregunta ${crossQuizRoundIndex + 1} de ${crossQuizRounds.length}`, `Question ${crossQuizRoundIndex + 1} of ${crossQuizRounds.length}`)}</p>
              <p className="flex gap-1 text-xl" title={t('Vidas', 'Lives')}>{Array.from({ length: CROSS_QUIZ_MAX_STRIKES }, (_, i) => (<span key={i} aria-hidden className={i < crossQuizStrikes ? 'opacity-25' : 'opacity-100'}>❤️</span>))}</p>
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
          {crossQuizResult === 'correct' ? (<><span className="text-4xl" aria-hidden>✅</span><p className="text-xl font-semibold text-green-400 mt-2">{t('¡Correcto!', 'Correct!')}</p></>) : (<><span className="text-4xl" aria-hidden>❌</span><p className="text-xl font-semibold text-red-400 mt-2">{t('Incorrecto', 'Incorrect')}</p></>)}
        </div>
      )}
      {gameState === 'cross_quiz_win' && (
        <div className="min-h-[320px] p-6 rounded-xl bg-green-500/20 border border-green-500/30 text-center animate-fade-in flex flex-col items-center justify-center">
          <span className="text-5xl" aria-hidden>🏆</span>
          <p className="text-2xl font-bold text-green-400 mt-2">{t('¡Ganadores!', 'Winners!')}</p>
          <p className="text-lg text-green-300 mt-1">{t('Os conocéis bien', 'You know each other well')}</p>
        </div>
      )}
      {gameState === 'cross_quiz_lose' && (
        <div className="min-h-[320px] p-6 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in flex flex-col items-center justify-center">
          <span className="text-5xl" aria-hidden>💔</span>
          <p className="text-2xl font-bold text-red-400 mt-2">{t('No habéis superado el reto', 'You did not complete the challenge')}</p>
          <p className="text-sm text-red-300 mt-1">{t('3 fallos = partida perdida', '3 mistakes = game lost')}</p>
        </div>
      )}
      {gameState === 'invalid' && validationResult && !validationResult.valid && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2"><span className="text-4xl" aria-hidden>💔</span><span className="text-lg font-semibold text-red-400">{t('Pareja inválida', 'Invalid match')}</span></div>
          {(validationResult.message || error) && <p className="text-sm text-red-300">{validationResult.message || (error && localizeOperatorMessage(error, t))}</p>}
        </div>
      )}
    </>
  )

  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} logoElement={logoElement} playersElement={playersElement}>
          <LandscapeInfoInstruction>
            {t('Escanea el QR y pulsa JUGAR. Responde al quiz.', 'Scan the QR code and tap PLAY. Answer the quiz.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Te asignamos un grupo (Casado / Puede ser / Soltero).', 'You will be assigned to a group (Married / Maybe / Single).')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Aquí ves cuánta gente hay en cada grupo.', 'Here you can see how many people are in each group.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Validad juntos vuestros códigos aquí.', 'Validate your codes together here.')}
          </LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>
        <div className={GAME_LANDSCAPE_CENTER_CARD}>
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
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
      {!showJoinBlock && (
        <div className="flex justify-end mb-2 flex-shrink-0">
          <BackButton onClick={handleReset} aria-label={t('Volver', 'Back')} />
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {semaforoMainContent}
      </div>
    </div>
  )
}
