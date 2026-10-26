import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/api'
import { OperatorLanguageSelector, useOperatorLanguage } from '../shell/operatorLanguage'

type GamePlayer = {
  playerId: number
  username: string
}

type PlayersResponse = {
  ok: boolean
  players?: GamePlayer[]
}

type Props = {
  gameId: string
  onBack: () => void
  onClose: () => void
}

export default function GamePlayersSettings({ gameId, onBack, onClose }: Props) {
  const { t } = useOperatorLanguage()
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null)
  const [confirmPlayer, setConfirmPlayer] = useState<GamePlayer | null>(null)
  const [error, setError] = useState('')

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get<PlayersResponse>(`/v1/game/players?gameId=${encodeURIComponent(gameId)}`)
      if (!result.ok || !Array.isArray(result.players)) {
        throw new Error(t('No se pudo cargar la lista de jugadores.', 'Could not load the player list.'))
      }
      setPlayers(result.players)
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : t('No se pudo cargar la lista de jugadores.', 'Could not load the player list.'))
    } finally {
      setLoading(false)
    }
  }, [gameId, t])

  useEffect(() => { void loadPlayers() }, [loadPlayers])

  const removePlayer = async () => {
    if (!confirmPlayer || busyPlayerId !== null) return
    const player = confirmPlayer
    setBusyPlayerId(player.playerId)
    setError('')
    try {
      const result = await api.delete<{ ok: boolean }>('/v1/game/players', {
        gameId,
        playerId: player.playerId,
      })
      if (!result.ok) {
        throw new Error(t('No se pudo eliminar al jugador.', 'Could not remove the player.'))
      }
      setPlayers(current => current.filter(item => item.playerId !== player.playerId))
      setConfirmPlayer(null)
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : t('No se pudo eliminar al jugador.', 'Could not remove the player.'))
    } finally {
      setBusyPlayerId(null)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="game-players-title" className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onBack} aria-hidden="true" />
      <div className="relative card w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              disabled={busyPlayerId !== null}
              className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 disabled:opacity-40"
              aria-label={t('Volver a configuración', 'Back to settings')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="game-players-title" className="text-xl font-semibold truncate">{t('Jugadores', 'Players')}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OperatorLanguageSelector />
            <button
              type="button"
              onClick={onClose}
              disabled={busyPlayerId !== null}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40"
              aria-label={t('Cerrar configuración', 'Close settings')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {loading && <p className="text-textSub">{t('Cargando jugadores...', 'Loading players...')}</p>}
          {!loading && error && players.length === 0 && (
            <div className="space-y-3">
              <p role="alert" className="text-red-400">{error}</p>
              <button type="button" onClick={() => void loadPlayers()} className="rounded-lg border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30">
                {t('Reintentar', 'Retry')}
              </button>
            </div>
          )}
          {!loading && !error && players.length === 0 && (
            <p className="text-textSub">{t('Todavía no hay jugadores en esta partida.', 'There are no players in this game yet.')}</p>
          )}
          {!loading && error && players.length > 0 && (
            <div className="mb-3 space-y-2">
              <p role="alert" className="text-red-400">{error}</p>
              <button type="button" onClick={() => void loadPlayers()} className="rounded-lg border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30">
                {t('Reintentar', 'Retry')}
              </button>
            </div>
          )}
          {!loading && players.length > 0 && (
            <ul className="space-y-2" aria-label={t('Lista de jugadores', 'Player list')}>
              {players.map(player => (
                <li key={player.playerId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{player.username}</div>
                    <div className="text-sm text-textSub">#{player.playerId}</div>
                  </div>
                  {confirmPlayer?.playerId === player.playerId ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmPlayer(null)}
                        disabled={busyPlayerId !== null}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        {t('Cancelar', 'Cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removePlayer()}
                        disabled={busyPlayerId !== null}
                        className="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {busyPlayerId === player.playerId
                          ? t('Eliminando...', 'Removing...')
                          : t('Confirmar eliminación', 'Confirm removal')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmPlayer(player)}
                      disabled={busyPlayerId !== null}
                      aria-label={t(`Eliminar a ${player.username}`, `Remove ${player.username}`)}
                      className="shrink-0 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {t('Eliminar', 'Remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
