import type { GameDefinition } from '../../core/types'
import StackGameScreen from './GameScreen'
import StackGameConfig from './GameConfig'

export const stackDefinition: GameDefinition = {
  id: 'STACK',
  name: 'STACK',
  description: 'Apila pizzas rectangulares en un arcade 3D para móviles.',
  descriptionLong: 'Arcade 3D de REKETE Pizza. Toca para apilar, encadena colocaciones perfectas y evita perder superficie. Un solo intento por participante, con puntuación validada por el servidor y ranking del evento.',
  tags: { playerMode: 'solo', competitive: true, social: false, idealFor: ['stand_feria', 'fiesta'] },
  colors: {
    primary: '#E85D32',
    accent: '#F4CF72',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/stack-logo.png',
  },
  GameScreen: StackGameScreen,
  GameConfigComponent: StackGameConfig,
  showRanking: true,
}
