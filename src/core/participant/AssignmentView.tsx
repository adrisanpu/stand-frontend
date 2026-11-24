import { loadAssignment } from './playerSession'
import type { PublicGameResponse } from '../../api/publicApi'
import { useParticipantLanguage } from './participantLanguage'
import ParticipantPrizePromo from './ParticipantPrizePromo'
import ProfileAvatar from '../widgets/ProfileAvatar'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  playerToken: string
  onValidate: () => void
  showPrizePromo?: boolean
}

export default function AssignmentView({ gameId, gameMeta, onValidate, showPrizePromo = true }: Props) {
  const { t } = useParticipantLanguage()
  const assignment = loadAssignment(gameId)
  if (!assignment || !('characterName' in assignment)) {
    return <p className="text-center text-textSub">{t('Sesión no encontrada. Vuelve a registrarte.')}</p>
  }

  return (
    <div className="space-y-5 text-center">
      <div className="flex items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-sm text-textSub uppercase tracking-wide">{t('Te toca')}</p>
          <h2 className="break-words text-2xl font-bold text-textMain">{assignment.characterName}</h2>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <ProfileAvatar profilePicUrl={assignment.profilePicUrl} username={assignment.participantName} size="md" />
          <span className="truncate text-sm font-medium text-textMain">{assignment.participantName || t('Jugador')}</span>
        </div>
      </div>
      <div className="play-character min-h-[16rem] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {assignment.characterImageUrl && (
          <img
            src={assignment.characterImageUrl}
            alt={assignment.characterName || t('Personaje')}
            className="mx-auto h-64 w-64 max-w-full object-contain rounded-2xl"
          />
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-textSub uppercase tracking-wide">{t('Tu misión:')}</p>
          <p className="text-lg font-semibold text-accent uppercase break-words">
            {t('Encuentra a')}{' '}
            <span>{assignment.partnerCharacterName}</span>
          </p>
        </div>
        {assignment.partnerCharacterImageUrl && (
          <img
            src={assignment.partnerCharacterImageUrl}
            alt={assignment.partnerCharacterName}
            className="h-16 w-16 object-contain rounded-xl bg-white/5"
          />
        )}
      </div>

      <p className="text-sm text-textSub">
        {t('Cuando os encontréis, validad los dos códigos desde el móvil y recoged vuestro premio.')}
      </p>

      {showPrizePromo && <ParticipantPrizePromo catalog={gameMeta.prizeCatalog} slots={['validation']} />}

      <button
        type="button"
        onClick={onValidate}
        className="w-full rounded-xl py-3 font-semibold text-accent bg-[rgba(var(--color-accent-rgb),0.2)] border border-[rgba(var(--color-accent-rgb),0.35)]"
      >
        {t('Validar pareja')}
      </button>

    </div>
  )
}
