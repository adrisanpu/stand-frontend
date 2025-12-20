import type { GameDefinition } from '../../core/types'
import L3trasGameScreen from './GameScreen'
import L3trasGameConfig from './GameConfig'

export const l3trasDefinition: GameDefinition = {
  id: 'l3tras',
  name: 'L3tras',
  description: 'Forma la palabra objetivo con las letras de los códigos.',
  colors: {
    primary: '#10B981',   // emerald green
    accent: '#34D399',    // light green
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/l3tras-logo.png',
    clientLogo: '/client-logo.png',
    standLogo: '/stand-logo.png',
  },
  GameScreen: L3trasGameScreen,
  showRanking: false,
  GameConfigComponent: L3trasGameConfig,
}

