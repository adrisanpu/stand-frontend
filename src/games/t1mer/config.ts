import type { GameDefinition } from '../../core/types'
import T1merGameScreen from './GameScreen'

export const t1merDefinition: GameDefinition = {
  id: 't1mer',
  name: 'T1mer',
  description: 'Juego de precisión temporal.',
  colors: {
    primary: '#F02230', // neonRed
    accent: '#632727', // softRed
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/t1mer-logo.png', // You'll need to add this asset
    clientLogo: '/client-logo.png',
    standLogo: '/stand-logo.png',
  },
  GameScreen: T1merGameScreen,
  showRanking: true,
}

