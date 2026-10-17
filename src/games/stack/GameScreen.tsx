import type { GameScreenProps } from '../../core/types'
import MobileParticipantsPanel from '../../core/widgets/MobileParticipantsPanel'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import { GAME_LANDSCAPE_CENTER_CARD, GAME_LANDSCAPE_THREE_COL_GRID } from '../../core/ui/gameScreenLayout'

export default function StackGameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement, joinChannel }: GameScreenProps) {
  const panel = (
    <div className="min-h-0 overflow-y-auto w-full">
      <MobileParticipantsPanel gameId={gameId} gameName={localStorage.getItem('gameName') || gameId} />
      <p className="text-sm text-textSub text-center px-4 pb-4">
        Juega STACK desde el móvil. Un único intento, consumido al empezar. Al terminar, el servidor valida y guarda tu puntuación en el ranking.
      </p>
    </div>
  )
  if (orientation !== 'landscape') return panel
  return (
    <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
      <GameLandscapeLeftColumn
        gameId={gameId}
        joinChannel={joinChannel ?? 'web'}
        logoElement={logoElement ?? <h1 className="text-3xl font-bold text-center">STACK</h1>}
        playersElement={playersElement}
      >
        <LandscapeInfoInstruction>{joinChannel === 'instagram' ? 'Escanea el QR y recibe tu enlace personal por Instagram.' : 'Escanea el QR para registrarte desde el móvil.'}</LandscapeInfoInstruction>
        <LandscapeInfoInstruction>Toca para apilar los bloques. Solo tienes un intento al empezar.</LandscapeInfoInstruction>
        <LandscapeInfoInstruction>Apila más bloques para subir en el ranking del evento.</LandscapeInfoInstruction>
      </GameLandscapeLeftColumn>
      <div className={`${GAME_LANDSCAPE_CENTER_CARD} justify-center`}>{panel}</div>
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden">{sidebarElement}</div>
    </div>
  )
}
