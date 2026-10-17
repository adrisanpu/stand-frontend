import { useState } from 'react'
import { loadAssignment } from './playerSession'
import type { PublicGameResponse } from '../../api/publicApi'
import { resolveGameAccess } from '../settings/gameAccess'
import { normalizeGameType } from '../gameTypeMap'
import { useParticipantLanguage } from './participantLanguage'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  playerToken: string
  onValidate: () => void
}

export default function AssignmentView({ gameId, gameMeta, onValidate }: Props) {
  const { t } = useParticipantLanguage()
  const assignment = loadAssignment(gameId)
  const [showCode, setShowCode] = useState(false)
  const isMobile = resolveGameAccess(normalizeGameType(gameMeta.gameType), gameMeta).playMode === 'mobile'
  if (!assignment || !('characterName' in assignment)) {
    return <p className="text-center text-textSub">{t('Sesión no encontrada. Vuelve a registrarte.')}</p>
  }

  return (
    <div className="space-y-5 text-center">
      <div className="relative min-h-[16rem] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <p className="absolute left-3 top-3 z-10 rounded-lg bg-black/60 px-2 py-1 text-left text-sm text-white uppercase tracking-wide">{t('Te toca')}</p>
        {assignment.characterImageUrl && (
          <img
            src={assignment.characterImageUrl}
            alt={assignment.characterName || t('Personaje')}
            className="mx-auto h-64 w-64 max-w-full object-contain rounded-2xl"
          />
        )}
        <h2 className="absolute bottom-3 right-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg bg-black/60 px-2 py-1 text-right text-2xl font-bold text-white break-words">{assignment.characterName}</h2>
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

      {!isMobile && showCode && <div className="rounded-xl border border-[rgba(var(--color-primary-rgb),0.35)] bg-[rgba(var(--color-primary-rgb),0.1)] p-4" role="status">
        <p className="text-sm text-textSub">{t('Tu código')}</p>
        <p className="text-4xl font-mono font-bold tracking-widest">{assignment.validationCode}</p>
      </div>}

      <p className="text-sm text-textSub">
        {t(isMobile
          ? 'Cuando os encontréis, validad los dos códigos desde el móvil y recoged vuestro premio.'
          : 'Cuando os encontréis, llevad vuestros códigos a la pantalla máster del evento para validar la pareja.')}
      </p>

      {(isMobile || !showCode) && <button
        type="button"
        onClick={isMobile ? onValidate : () => setShowCode(true)}
        className="w-full rounded-xl py-3 font-semibold text-accent bg-[rgba(var(--color-accent-rgb),0.2)] border border-[rgba(var(--color-accent-rgb),0.35)]"
      >
        {t('Validar pareja')}
      </button>}

    </div>
  )
}
