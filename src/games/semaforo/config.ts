import type { GameDefinition } from '../../core/types'
import SemaforoGameScreen from './GameScreen'

export const semaforoDefinition: GameDefinition = {
  id: 'semaforo',
  name: 'Semáforo',
  description: 'Rojo, amarillo o verde. Tú decides...',
  descriptionLong: 'Los jugadores se clasifican en Casado (rojo), Puede ser (amarillo) o Soltero (verde). Tras validar la pareja, un quiz cruzado pone a prueba si os conocéis bien. Ideal para eventos en vivo donde quieras romper el hielo y que la gente se mezcle según su estado.',
  tags: { playerMode: 'multi', social: true, competitive: false, idealFor: ['fiesta', 'evento_corporativo'] },
  colors: {
    primary: '#22C55E',
    accent: '#EAB308',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  assets: {
    logo: '/images/semaforo-logo.png',
    clientLogo: '/client-logo.png',
    standLogo: '/images/stand-logo.png',
  },
  GameScreen: SemaforoGameScreen,
  showRanking: false,
}
