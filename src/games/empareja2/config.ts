import type { GameDefinition } from '../../core/types'
import Empareja2GameScreen from './GameScreen'

export const empareja2Definition: GameDefinition = {
  id: 'empareja2',
  name: 'Empareja2',
  description: 'Encuentra a tu pareja asignada.',
  descriptionLong: 'Cada jugador tiene una pareja asignada por el sistema. El reto es encontrarla en la sala e intercambiar los códigos de validación. Gana la pareja que se valide correctamente. Perfecto para dinámicas de networking y que la gente se mueva y hable.',
  tags: { playerMode: 'multi', social: true, competitive: false },
  colors: {
    primary: '#B026FF',
    accent: '#22D3EE',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/empareja2-logo.png',
    clientLogo: '/client-logo.png',
    standLogo: '/images/stand-logo.png',
  },
  GameScreen: Empareja2GameScreen,
  showRanking: false,
}

