import type { GameScreenProps } from '../../core/types'
import MobileParticipantsPanel from '../../core/widgets/MobileParticipantsPanel'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import { GAME_LANDSCAPE_CENTER_CARD, GAME_LANDSCAPE_THREE_COL_GRID } from '../../core/ui/gameScreenLayout'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'

export default function StackGameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement, joinChannel }: GameScreenProps) {
  const { t } = useOperatorLanguage()
  const panel = (
    <div className="min-h-0 overflow-y-auto w-full">
      <MobileParticipantsPanel gameId={gameId} gameName={localStorage.getItem('gameName') || gameId} />
      <p className="text-sm text-textSub text-center px-4 pb-4">
        {t('Juega STACK desde el móvil. Un único intento, consumido al empezar. Al terminar, el servidor valida y guarda tu puntuación en el ranking.', 'Play STACK on your phone. You get one attempt, used when you start. When you finish, the server validates and saves your score to the leaderboard.')}
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
        <LandscapeInfoInstruction>{t('Escanea el QR y completa el formulario web desde tu móvil.', 'Scan the QR code and complete the web form on your phone.')}</LandscapeInfoInstruction>
        <LandscapeInfoInstruction>{t('Toca para apilar los bloques. Solo tienes un intento al empezar.', 'Tap to stack the blocks. You only get one attempt once you start.')}</LandscapeInfoInstruction>
        <LandscapeInfoInstruction>{t('Apila más bloques para subir en el ranking del evento.', 'Stack more blocks to climb the event leaderboard.')}</LandscapeInfoInstruction>
      </GameLandscapeLeftColumn>
      <div className={`${GAME_LANDSCAPE_CENTER_CARD} justify-center`}>{panel}</div>
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden">{sidebarElement}</div>
    </div>
  )
}
