import ScoreResultView from '../../core/participant/ScoreResultView'
import { loadAssignment } from '../../core/participant/playerSession'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import type { PrizeCatalog } from '../../core/prizes'
import ParticipantPrizePromo from '../../core/participant/ParticipantPrizePromo'

type Props = {
  gameId: string
  time: number
  difference: number
  rank: number | null
  prizeCatalog?: PrizeCatalog
  showPrizePromo?: boolean
}

function formatDiff(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`
}

export default function T1merParticipantResult({ gameId, time, difference, rank, prizeCatalog, showPrizePromo = true }: Props) {
  const { t } = useParticipantLanguage()
  const assignment = loadAssignment(gameId)
  const displayName =
    assignment && 'displayName' in assignment ? assignment.displayName : t('Jugador')
  const profilePicUrl =
    assignment && 'profilePicUrl' in assignment ? assignment.profilePicUrl : null
  const scoreMs = Math.round(difference * 1000)

  return (
    <ScoreResultView
      title={t('¡Hecho!')}
      displayName={displayName}
      profilePicUrl={profilePicUrl}
      rank={rank}
      notice={t('Solo un intento. Mira el ranking en la pantalla del evento.')}
    >
      {showPrizePromo && <ParticipantPrizePromo catalog={prizeCatalog} slots={['ranking']} />}
      <div className="space-y-1">
        <p className="text-sm text-textSub">{t('Tu tiempo')}</p>
        <p className="text-3xl font-digital font-bold tabular-nums">{time.toFixed(3)} s</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-textSub">{t('Diferencia vs 10.000 s')}</p>
        <p className="text-xl font-semibold">{formatDiff(scoreMs)}</p>
      </div>
    </ScoreResultView>
  )
}
