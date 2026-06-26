import type { GameDefinition } from '../../core/types'
import CupidoGameScreen from './GameScreen'

export const cupidoDefinition: GameDefinition = {
  id: 'CUPIDO',
  name: 'CUPIDO',
  description: 'Encuentra personas con gustos afines.',
  descriptionLong: 'Empareja a participantes según sus respuestas a un cuestionario. Cada uno ve un semáforo (rojo/amarillo/verde) que indica compatibilidad. El objetivo es encontrar a tu pareja asignada y validar el código entre los dos. Muy social y pensado para eventos.',
  tags: { playerMode: 'multi', social: true, competitive: false, idealFor: ['fiesta', 'evento_corporativo'] },
  underDevelopment: true,
  colors: {
    primary: '#E11D48',
    accent: '#F472B6',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/cupido-logo.png',
    clientLogo: '/client-logo.png',
    standLogo: '/images/logo-stand-footer.png',
  },
  GameScreen: CupidoGameScreen,
  showRanking: false,
}
