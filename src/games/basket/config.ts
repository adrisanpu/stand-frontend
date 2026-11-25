import type { GameDefinition } from '../../core/types'

export const basketDefinition: GameDefinition = {
  id: 'BASKET',
  name: 'BASKET',
  description: 'Desliza para lanzar y consigue canastas en 30 segundos.',
  descriptionLong: 'Juego arcade de baloncesto para móviles. Desliza desde el balón para lanzar mientras el aro se mueve. Tienes 30 segundos, un único intento y un punto por cada canasta. El resultado se valida en el servidor.',
  tags: { playerMode: 'solo', competitive: true, social: false, idealFor: ['stand_feria', 'fiesta'] },
  colors: {
    primary: '#E85D32',
    accent: '#F4CF72',
    background: '#10151A',
    surface: 'rgba(255,255,255,0.06)',
    textMain: '#F5F7F8',
    textSub: '#B8C2C9',
  },
  assets: {
    logo: '/images/basket-logo.png',
  },
  showRanking: true,
}
