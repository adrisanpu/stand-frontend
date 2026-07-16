import DualScreenOperatorPanel from '../../core/widgets/DualScreenOperatorPanel'

type Props = {
  gameId: string
  gameName: string
}

export default function Empareja2OperatorScreen({ gameId, gameName }: Props) {
  return <DualScreenOperatorPanel gameId={gameId} gameName={gameName} />
}
