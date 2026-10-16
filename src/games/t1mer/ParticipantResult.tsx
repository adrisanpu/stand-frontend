import ScoreResultView from '../../core/participant/ScoreResultView'
import { loadAssignment } from '../../core/participant/playerSession'

type Props = {
  gameId: string
  time: number
  difference: number
  rank: number | null
}

function formatDiff(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`
}

export default function T1merParticipantResult({ gameId, time, difference, rank }: Props) {
  const assignment = loadAssignment(gameId)
  const displayName =
    assignment && 'displayName' in assignment ? assignment.displayName : 'Jugador'
  const profilePicUrl =
    assignment && 'profilePicUrl' in assignment ? assignment.profilePicUrl : null
  const scoreMs = Math.round(difference * 1000)

  return (
    <ScoreResultView
      title="¡Hecho!"
      displayName={displayName}
      profilePicUrl={profilePicUrl}
      rank={rank}
      notice="Solo un intento. Mira el ranking en la pantalla del evento."
    >
      <div className="space-y-1">
        <p className="text-sm text-textSub">Tu tiempo</p>
        <p className="text-3xl font-digital font-bold tabular-nums">{time.toFixed(3)} s</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-textSub">Diferencia vs 10.000 s</p>
        <p className="text-xl font-semibold">{formatDiff(scoreMs)}</p>
      </div>
    </ScoreResultView>
  )
}
