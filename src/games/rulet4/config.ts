import type { GameDefinition } from '../../core/types'
import Rulet4GameScreen from './GameScreen'
import Rulet4GameConfig from './GameConfig'

export const rulet4Definition: GameDefinition = {
  id: 'rulet4',
  name: 'Rulet4',
  description: 'Ruleta personalizable.',
  descriptionLong: 'Ruleta de premios o acciones personalizable para el evento. El organizador configura opciones y la ruleta decide quién gana o qué reto toca. Puede usarse para sorteos, dinámicas o simplemente animar el público. Multijugador en formato sala.',
  tags: { playerMode: 'multi', social: false, competitive: false, idealFor: ['fiesta', 'stand_feria', 'evento_corporativo'] },
  colors: {
    primary: '#FACC15',   // yellow
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

