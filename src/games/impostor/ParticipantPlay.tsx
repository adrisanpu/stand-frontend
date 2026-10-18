import { useEffect, useState } from 'react'
import { publicApi, type ImpostorAssignment, type ImpostorParticipantState } from '../../api/publicApi'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

const POLL_MS = 3000

type Props = {
  gameId: string
  playerToken: string
  initialAssignment: ImpostorAssignment
}

export default function ImpostorParticipantPlay({ gameId, playerToken, initialAssignment }: Props) {
  const { t } = useParticipantLanguage()
  const [assignment, setAssignment] = useState<ImpostorAssignment>(initialAssignment)
  const [refreshFailed, setRefreshFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const player = await publicApi.getPlayer(playerToken, gameId)
        if (cancelled) return
        if (!player.ok || player.gameId !== gameId || !player.assignment || !('displayName' in player.assignment)) {
          throw new Error('Invalid player state')
        }
        setAssignment(player.assignment as ImpostorAssignment)
        setRefreshFailed(false)
      } catch {
        if (!cancelled) setRefreshFailed(true)
      }
    }
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [gameId, playerToken])

  const state = assignment.impostor
  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-textSub">{assignment.displayName}</p>
      {!assignment.validated ? (
        <div className="space-y-2">
          <p className="text-sm text-textSub">{t('Tu código')}</p>
          <p className="text-4xl font-digital font-bold tracking-widest tabular-nums">{assignment.validationCode ?? '—'}</p>
          <p className="text-sm text-textSub">{t('Díselo al equipo del evento para entrar en la partida.')}</p>
        </div>
      ) : (
        <ImpostorRound state={state} />
      )}
      {refreshFailed && (
        <p role="alert" className="text-sm text-red-300">{t('No se pudo actualizar la partida. Reintentando...')}</p>
      )}
    </div>
  )
}

function ImpostorRound({ state }: { state?: ImpostorParticipantState }) {
  const { t } = useParticipantLanguage()
  if (!state || state.phase === 'lobby') {
    return <p className="font-semibold">{t('Estás en la lista. Espera a que empiece la partida.')}</p>
  }
  if (!state.inRound) {
    return <p className="font-semibold">{t('La ronda ya ha empezado. Entrarás en la siguiente.')}</p>
  }
  const finished = state.phase === 'result' || state.phase === 'finished'
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
        {state.role === 'impostor' ? (
          <>
            <p className="text-2xl font-bold">{t('Eres el impostor')}</p>
            <p className="text-sm text-textSub">{t('No conoces la palabra. Disimula para que no te descubran.')}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-textSub">{t('Tu palabra')}</p>
            <p className="text-3xl font-bold">{state.word}</p>
          </>
        )}
      </div>
      {!finished && <p className="text-xs text-textSub">{t('No enseñes tu pantalla a los demás jugadores.')}</p>}
      {state.phase === 'word_round' && state.currentTurn && (
        <p className="font-semibold">
          {state.currentTurn.isMine
            ? t('¡Te toca! Di una palabra en voz alta.')
            : `${t('Turno de')} ${state.currentTurn.name}`}
        </p>
      )}
      {state.phase === 'voting' && (
        <p className="font-semibold">{t('Votación: di al equipo del evento quién crees que es el impostor.')}</p>
      )}
      {finished && state.winner && (
        <div className="space-y-1">
          <p className="text-lg font-semibold">
            {state.winner === 'crew' ? t('Ganan los jugadores') : t('Gana el impostor')}
          </p>
          {state.won !== null && <p className="text-2xl font-bold">{state.won ? t('¡Has ganado!') : t('Has perdido')}</p>}
        </div>
      )}
    </div>
  )
}
