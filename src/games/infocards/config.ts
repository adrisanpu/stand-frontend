import type { GameDefinition } from '../../core/types'
import InfocardsGameScreen from './GameScreen'
import InfocardsGameConfig from './GameConfig'

export const infocardsDefinition: GameDefinition = {
  id: 'infocards',
  name: 'Info Cards',
  description: 'Presenta tu producto o servicio en tarjetas informativas.',
  descriptionLong:
    'Muestra información sobre tu producto, servicio o marca en una secuencia de tarjetas visuales. Sube un PDF, texto o imágenes y la IA genera las tarjetas automáticamente. Ideal para ferias y eventos.',
  tags: { playerMode: 'solo', social: false, competitive: false, idealFor: ['stand_feria', 'presentacion'] },
  colors: {
    primary: '#6366F1',
    accent: '#818CF8',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/infocards-logo.png',
    standLogo: '/images/logo-stand-footer.png',
  },
  GameScreen: InfocardsGameScreen,
  showRanking: false,
  GameConfigComponent: InfocardsGameConfig,
}
