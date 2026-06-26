import { useEffect, useMemo, useState } from 'react'
import type { GameScreenProps } from '../../core/types'
import { api } from '../../api/api'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import BackButton from '../../core/widgets/BackButton'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'

type Phase = 'lobby' | 'word_round' | 'voting' | 'result' | 'finished'

type LobbyPlayer = {
  playerId: number
  instagramUsername?: string
  instagramProfilePicUrl?: string
}

type ImpostorStateResponse = {
  ok: boolean
  maxPlayers?: number
  phase: Phase
  round?: number
  wordRoundTurnIndex?: number
  players: LobbyPlayer[]
  impostorPlayerId?: number | null
  selectedWord?: string | null
  votes?: Record<string, number>
  winner?: 'impostor' | 'crew' | null
}

type ValidateResponse = {
  valid: boolean
  playerId?: number
  username?: string
  profilePicUrl?: string
  message?: string
}

export default function ImpostorGameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement, onAvatarStateChange }: GameScreenProps) {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [state, setState] = useState<ImpostorStateResponse | null>(null)
  const [, setLoadingState] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [voterPlayerId, setVoterPlayerId] = useState<number | null>(null)
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)

  const players = state?.players ?? []
  const placeholderCount = state?.maxPlayers && state.maxPlayers > 0 ? state.maxPlayers : Math.max(players.length, 1)
  const placeholders = useMemo(
    () => Array.from({ length: placeholderCount }).map((_, idx) => players[idx] ?? null),
    [players, placeholderCount],
  )

  const loadState = async () => {
    if (!gameId) return
    setLoadingState(true)
    try {
      const data = await api.get<ImpostorStateResponse>(`/v1/game/impostor?gameId=${encodeURIComponent(gameId)}`)
      if (data.ok) setState(data)
    } catch {
      // keep existing state on transient failures
    } finally {
      setLoadingState(false)
    }
  }

  useEffect(() => {
    void loadState()
    if (!gameId) return
    const id = window.setInterval(() => void loadState(), 4000)
    return () => window.clearInterval(id)
  }, [gameId])

  useEffect(() => {
    if (!state || autoStarted) return
    if (state.phase !== 'lobby') return
    const max = typeof state.maxPlayers === 'number' ? state.maxPlayers : null
    if (max && players.length >= max) {
      setAutoStarted(true)
      void postAction('start_round')
    }
  }, [state, players.length, autoStarted])

  useEffect(() => {
    const avatarState =
      state?.phase === 'result' || state?.phase === 'finished'
        ? state.winner === 'impostor'
          ? 'lose'
          : 'win'
        : state?.phase === 'word_round' || state?.phase === 'voting'
          ? 'playing'
          : 'idle'
    onAvatarStateChange?.(avatarState)
  }, [state, onAvatarStateChange])

  const validate = async () => {
    if (!gameId || code.length !== 4) return
    setActionLoading(true)
    setFeedback(null)
    try {
      const res = await api.post<ValidateResponse>('/v1/game/validate', { gameId, codes: [code] })
      setFeedback(res.message ?? (res.valid ? 'Código validado.' : 'Código inválido.'))
      setCode('')
      await loadState()
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo validar el código.')
    } finally {
      setActionLoading(false)
    }
  }

  const postAction = async (action: 'start_round' | 'advance_turn' | 'start_voting' | 'finish_voting') => {
    if (!gameId) return
    setActionLoading(true)
    try {
      await api.post('/v1/game/impostor', { gameId, action })
      await loadState()
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'Acción no disponible.')
    } finally {
      setActionLoading(false)
    }
  }

  const submitVote = async () => {
    if (!gameId || voterPlayerId == null || targetPlayerId == null) return
    setActionLoading(true)
    try {
      await api.post('/v1/game/impostor', { gameId, action: 'submit_vote', voterPlayerId, targetPlayerId })
      await loadState()
      setFeedback('Voto registrado.')
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo registrar el voto.')
    } finally {
      setActionLoading(false)
    }
  }

  const showBackButton = state?.phase !== 'lobby' && state?.phase !== undefined
  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  const phase = state?.phase ?? 'lobby'
  const primaryActionLabel =
    phase === 'lobby'
      ? 'Empezar partida'
      : phase === 'word_round'
        ? 'Siguiente turno'
        : phase === 'voting'
          ? 'Registrar voto'
          : 'Nueva ronda'
  const primaryActionDisabled =
    actionLoading || (phase === 'voting' && (voterPlayerId == null || targetPlayerId == null))

  const handlePrimaryAction = async () => {
    if (phase === 'lobby') {
      await postAction('start_round')
      return
    }
    if (phase === 'word_round') {
      await postAction('advance_turn')
      return
    }
    if (phase === 'voting') {
      await submitVote()
      return
    }
    await postAction('start_round')
  }

  const gameMainContent = (
    <div className="space-y-6 flex flex-col justify-center min-h-0">

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {placeholders.map((p, idx) => (
          <div key={idx} className="aspect-square rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-2 flex flex-col items-center justify-center text-center">
            {p?.instagramProfilePicUrl ? (
              <img src={p.instagramProfilePicUrl} alt={p.instagramUsername || `Jugador ${idx + 1}`} className="w-10 h-10 rounded-full object-cover mb-1" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 mb-1" />
            )}
            <span className="text-[11px] text-gray-300 truncate w-full">{p?.instagramUsername || 'Pendiente'}</span>
          </div>
        ))}
      </div>

      {state?.phase === 'voting' && (
        <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-gray-300">Votación (uno a uno)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={voterPlayerId ?? ''}
              onChange={(e) => setVoterPlayerId(Number(e.target.value))}
              className="h-10 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-2"
            >
              <option value="">Jugador que vota</option>
              {players.map((p) => (
                <option key={`voter-${p.playerId}`} value={p.playerId}>
                  {p.instagramUsername || `Jugador ${p.playerId}`}
                </option>
              ))}
            </select>
            <select
              value={targetPlayerId ?? ''}
              onChange={(e) => setTargetPlayerId(Number(e.target.value))}
              className="h-10 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 px-2"
            >
              <option value="">Sospechoso (impostor)</option>
              {players.map((p) => (
                <option key={`target-${p.playerId}`} value={p.playerId}>
                  {p.instagramUsername || `Jugador ${p.playerId}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(state?.phase === 'result' || state?.phase === 'finished') && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-gray-300">Resultado final</p>
          <p className="text-lg font-semibold mt-1">
            {state.winner === 'crew' ? 'Ganan los jugadores' : 'Gana el impostor'}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={primaryActionDisabled}
        onClick={() => void handlePrimaryAction()}
        className="w-full px-4 py-3.5 rounded-xl bg-[rgba(114,47,55,0.25)] border border-[rgba(114,47,55,0.5)] hover:bg-[rgba(114,47,55,0.35)] transition-colors disabled:opacity-50 font-semibold mt-1"
      >
        {primaryActionLabel}
      </button>
    </div>
  )

  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} logoElement={logoElement} playersElement={playersElement}>
          <LandscapeInfoInstruction>
            Escanea el QR y escribe al bot.
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            Introduce el código y valida.
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            Cada jugador dice una palabra.
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            Votad al posible impostor.
          </LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>

        <div className={`${GAME_LANDSCAPE_CENTER_CARD} justify-center`}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={CODE_INPUT_PLACEHOLDER}
                className="flex-1 h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-center"
              />
              <button
                type="button"
                onClick={validate}
                disabled={actionLoading || code.length !== 4}
                className="px-4 rounded-xl bg-[rgba(114,47,55,0.25)] border border-[rgba(114,47,55,0.5)] disabled:opacity-50"
              >
                {VALIDATE_LABEL}
              </button>
            </div>
            {feedback && <p className="text-sm text-gray-300">{feedback}</p>}
          </div>
          {gameMainContent}
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
      {showBackButton && (
        <div className="flex justify-end mb-2 flex-shrink-0">
          <BackButton onClick={() => setFeedback(null)} aria-label="Volver" />
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
          <div className="flex-1 min-h-0 overflow-auto space-y-5 flex flex-col justify-center">
          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={CODE_INPUT_PLACEHOLDER}
              className="flex-1 h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-center"
            />
            <button
              type="button"
              onClick={validate}
              disabled={actionLoading || code.length !== 4}
              className="px-4 rounded-xl bg-[rgba(114,47,55,0.25)] border border-[rgba(114,47,55,0.5)] disabled:opacity-50"
            >
              {VALIDATE_LABEL}
            </button>
          </div>
          {feedback && <p className="text-sm text-gray-300">{feedback}</p>}
          {gameMainContent}
        </div>
      </div>
    </div>
  )
}
