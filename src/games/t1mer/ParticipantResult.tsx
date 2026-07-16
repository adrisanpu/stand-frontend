import ProfileAvatar from '../../core/widgets/ProfileAvatar'
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
    <div className="card p-6 text-center space-y-4">
      <div className="flex flex-col items-center gap-2">
        <ProfileAvatar profilePicUrl={profilePicUrl} username={displayName} size="lg" />
        <h2 className="text-2xl font-bold">¡Hecho!</h2>
        <p className="text-sm text-textSub truncate max-w-full">{displayName}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-textSub">Tu tiempo</p>
        <p className="text-3xl font-digital font-bold tabular-nums">{time.toFixed(3)} s</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-textSub">Diferencia vs 10.000 s</p>
        <p className="text-xl font-semibold">{formatDiff(scoreMs)}</p>
      </div>
      {rank != null && (
        <p className="text-lg">
          Posición: <span className="font-bold">#{rank}</span>
        </p>
      )}
      <p className="text-sm text-textSub">Solo un intento. Mira el ranking en la pantalla del evento.</p>
    </div>
  )
}
