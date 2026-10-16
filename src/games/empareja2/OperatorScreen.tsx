import MobileParticipantsPanel from '../../core/widgets/MobileParticipantsPanel'

type Props = {
  gameId: string
  gameName: string
}

export default function Empareja2OperatorScreen({ gameId, gameName }: Props) {
  return <MobileParticipantsPanel gameId={gameId} gameName={gameName} />
}
