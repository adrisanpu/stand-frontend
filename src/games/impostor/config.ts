import type { GameDefinition } from '../../core/types'
import ImpostorGameScreen from './GameScreen'
import ImpostorGameConfig from './GameConfig'

export const impostorDefinition: GameDefinition = {
  id: 'IMPOSTOR',
  name: 'IMPOSTOR',
  description: 'Adivina quién no conoce la palabra.',
  descriptionLong:
    'Todos reciben una palabra secreta excepto el impostor. Cada jugador dice una palabra relacionada, después se vota y la mayoría decide quién era el impostor.',
  tags: { playerMode: 'multi', social: true, competitive: true, idealFor: ['fiesta', 'evento_corporativo', 'stand_feria'] },
  colors: {
    primary: '#722F37',
    accent: '#B45C66',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/impostor-logo.png',
    standLogo: '/images/logo-stand-footer.png',
  },
  GameScreen: ImpostorGameScreen,
  showRanking: false,
  GameConfigComponent: ImpostorGameConfig,
}
