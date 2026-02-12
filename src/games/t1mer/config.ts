import type { GameDefinition } from '../../core/types'
import T1merGameScreen from './GameScreen'

export const t1merDefinition: GameDefinition = {
  id: 't1mer',
  name: 'T1mer',
  description: 'Juego de precisión temporal.',
  descriptionLong: 'Los jugadores deben pulsar o actuar en el momento exacto que indica el temporizador. Prueba de reflejos y precisión. Puede ser individual o en sala compitiendo por el mejor tiempo. Competitivo y con ranking.',
  tags: { playerMode: 'multi', social: false, competitive: true },
  colors: {
    primary: '#EF4444', // red
    accent: '#3B82F6', // blue
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/t1mer-logo.png',
    clientLogo: '/client-logo.png',
    standLogo: '/images/stand-logo.png',
  },
  GameScreen: T1merGameScreen,
  showRanking: true,
}

