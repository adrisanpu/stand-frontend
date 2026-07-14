import { loadAssignment } from './playerSession'
import type { PublicGameResponse } from '../../api/publicApi'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  playerToken: string
  onValidate: () => void
}

export default function AssignmentView({ gameId, gameMeta, onValidate }: Props) {
  const assignment = loadAssignment(gameId)
  if (!assignment) {
    return <p className="text-center text-textSub">Sesión no encontrada. Vuelve a registrarte.</p>
  }

  return (
    <div className="card p-6 space-y-5 text-center">
      <div>
        <p className="text-sm text-textSub uppercase tracking-wide">Te toca</p>
        <h2 className="text-2xl font-bold mt-1">{assignment.characterName}</h2>
      </div>

      {assignment.characterImageUrl && (
        <img
          src={assignment.characterImageUrl}
          alt={assignment.characterName || 'Personaje'}
          className="mx-auto h-40 w-40 object-contain rounded-2xl bg-white/5"
        />
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <p className="text-sm text-textSub">Tu misión: encuentra a</p>
        <p className="text-xl font-semibold text-neonCyan">{assignment.partnerCharacterName}</p>
      </div>

      <div className="rounded-xl border border-[rgba(176,38,255,0.35)] bg-[rgba(176,38,255,0.12)] p-4">
        <p className="text-sm text-textSub">Tu código</p>
        <p className="text-4xl font-mono font-bold tracking-widest">{assignment.validationCode}</p>
      </div>

      <p className="text-sm text-textSub">
        Cuando os encontréis, validad los dos códigos desde el móvil. La pantalla del evento mostrará el resultado.
      </p>

      <button
        type="button"
        onClick={onValidate}
        className="w-full rounded-xl py-3 font-semibold bg-[rgba(34,211,238,0.2)] border border-[rgba(34,211,238,0.35)]"
      >
        Validar pareja
      </button>

      {gameMeta.gameName && (
        <p className="text-xs text-textSub">Partida: {gameMeta.gameName}</p>
      )}
    </div>
  )
}
