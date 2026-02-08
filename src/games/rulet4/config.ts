import type { GameDefinition } from '../../core/types'
import Rulet4GameScreen from './GameScreen'
import Rulet4GameConfig from './GameConfig'

export const rulet4Definition: GameDefinition = {
  id: 'rulet4',
  name: 'Rulet4',
  description: 'Ruleta personalizable.',
  colors: {
    // Use a palette with TWO yellows as primary/accent
    primary: '#FACC15',   // yellow 1
    accent: '#FBBF24',    // yellow 2
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/ruleta-logo.png',
    clientLogo: '/client-logo.png', // can reuse an existing one if needed
    standLogo: '/images/stand-logo.png',
  },
  GameScreen: Rulet4GameScreen,
  showRanking: false,
  // NEW (see section 2): per-game configuration component
  GameConfigComponent: Rulet4GameConfig,
}

