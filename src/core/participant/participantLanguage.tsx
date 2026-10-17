import { createContext, useContext, useState, type ReactNode } from 'react'

type Language = 'es' | 'en'
const translations: Record<string, string> = {
  'Bloques: ': 'Blocks: ',
  'Reanudar': 'Resume',
  'Pausar': 'Pause',
  'Escena 3D de bloques apilados': '3D block-stacking scene',
  'Sin perder superficie': 'Without losing any surface area',
  'Toca para apilar': 'Tap to stack',
  'Cargando escena 3D...': 'Loading 3D scene...',
  'Se ha perdido el contexto gráfico. Partida pausada hasta su recuperación.': 'The graphics context was lost. The game is paused until it is restored.',
  'Partida pausada': 'Game paused',
  'Toca el bloque o pulsa COLOCAR para apilar. Solo tienes un intento: se consume al empezar, aunque cierres o recargues.': 'Tap the block or press PLACE to stack. You only have one attempt: it is used when you start, even if you close or reload the game.',
  'Al terminar, el servidor valida y guarda tu puntuación en el ranking.': 'When you finish, the server validates your score and saves it to the leaderboard.',
  'El backend necesita la actualización de Fase 3 antes de empezar. Tu intento no se ha consumido.': 'The backend needs the Phase 3 update before you can start. Your attempt has not been used.',
  'Confirmando intento...': 'Confirming attempt...',
  'Reintentar confirmación': 'Retry confirmation',
  'EMPEZAR': 'START',
  'Colocando...': 'Placing...',
  'COLOCAR': 'PLACE',
  'Tu intento no está disponible. Si ya empezó, recargar esta página no permite otra partida.': 'Your attempt is unavailable. If it has already started, reloading this page will not allow another game.',
  'Fin de la partida': 'Game over',
  'Resultado validado y guardado en el ranking. Tu único intento ya está consumido.': 'Result validated and saved to the leaderboard. Your only attempt has been used.',
  'Resultado local pendiente de confirmación del servidor. Tu único intento ya está consumido.': 'Local result awaiting server confirmation. Your only attempt has been used.',
  'Bloques apilados': 'Blocks stacked',
  'Validando y guardando resultado...': 'Validating and saving result...',
  'El backend necesita actualizarse para guardar este resultado. No se iniciará otra partida.': 'The backend needs to be updated to save this result. Another game will not be started.',
  'Reintentar guardado': 'Retry saving',
  'No se pudo recuperar el resultado pendiente.': 'Unable to recover the pending result.',
  'No se ha recibido una configuración válida de STACK.': 'A valid STACK configuration was not received.',
  'No se pudo recuperar la escena 3D.': 'Unable to recover the 3D scene.',
  'No se pudo cargar la escena 3D.': 'Unable to load the 3D scene.',
  'El inicio no devolvió las reglas del intento. No se iniciará otra partida; actualiza el backend y verifica tu estado.': 'Starting did not return the attempt rules. Another game will not be started; update the backend and check your status.',
  'El intento ya está confirmado en el servidor, pero no se pudo actualizar la sesión de este navegador. No cierres ni recargues la partida.': 'The attempt is confirmed on the server, but this browser session could not be updated. Do not close or reload the game.',
  'No se pudo confirmar el inicio de la partida.': 'Unable to confirm the game start.',
  'El backend ya ha consumido tu intento, pero no se pudo iniciar el juego: ': 'The backend has already used your attempt, but the game could not be started: ',
  'No se pudo conservar el envío en este navegador. No cierres ni recargues hasta confirmar el guardado.': 'Unable to preserve the submission in this browser. Do not close or reload until the save is confirmed.',
  'El servidor no confirmó un resultado válido. Reintenta el mismo envío.': 'The server did not confirm a valid result. Retry the same submission.',
  'Resultado guardado en el servidor, pero no se pudo actualizar la copia de este navegador.': 'The result was saved on the server, but this browser copy could not be updated.',
  'No se pudo confirmar el guardado del resultado.': 'Unable to confirm saving the result.',
  'Jugador': 'Player',
  'Jugando como': 'Playing as',
  'Detén el cronómetro lo más cerca posible de 10 segundos. Se oculta a los 5 s. Solo un intento.': 'Stop the timer as close as possible to 10 seconds. It disappears after 5 seconds. One attempt only.',
  'DETENER': 'STOP',
  'Enviando puntuación...': 'Submitting score...',
  'Error al enviar la puntuación': 'Error submitting score',
  '¡Hecho!': 'Done!',
  'Solo un intento. Mira el ranking en la pantalla del evento.': 'One attempt only. Check the leaderboard on the event screen.',
  'Tu tiempo': 'Your time',
  'Diferencia vs 10.000 s': 'Difference vs. 10.000 s',
  'Posición: ': 'Rank: ',
  'Cargando...': 'Loading...',
  'Te toca': 'Your character',
  'Personaje': 'Character',
  'Logo del cliente': 'Client logo',
  'Sesión no encontrada. Vuelve a registrarte.': 'Session not found. Please register again.',
  'Tu misión:': 'Your mission:',
  'Encuentra a': 'Find',
  'Tu código': 'Your code',
  'Cuando os encontréis, validad los dos códigos desde el móvil y recoged vuestro premio.': 'When you meet, validate both codes on your phone and collect your prize.',
  'Cuando os encontréis, llevad vuestros códigos a la pantalla máster del evento para validar la pareja.': 'When you meet, take your codes to the event screen to validate your pair.',
  'Validar pareja': 'Validate pair',
  'Introduce los dos códigos de la pareja.': 'Enter both pair codes.',
  'No sois la pareja correcta.': 'You are not the correct pair.',
  'Error al validar': 'Validation failed',
  'Muestra tu código e introduce el de tu pareja cuando os encontréis': 'Show your code and enter your partner’s code when you meet',
  'No disponible': 'Not available',
  'Código de tu pareja': 'Your partner’s code',
  'Validando...': 'Validating...',
  'Validar': 'Validate',
  'Volver': 'Back',
  'El email es obligatorio.': 'Email is required.',
  'El usuario de Instagram es obligatorio.': 'An Instagram username is required.',
  'Debes aceptar la política de privacidad.': 'You must accept the privacy policy.',
  'Error al registrarse': 'Registration failed',
  'Regístrate para jugar desde tu móvil': 'Register to play on your phone',
  'Regístrate para jugar en la pantalla máster': 'Register to play on the event screen',
  ' (opcional)': ' (optional)',
  'tu@email.com': 'you@email.com',
  '@usuario': '@username',
  'Política de privacidad': 'Privacy policy',
  'Acepto que Stand y el organizador traten mi email y, si lo indico, mi usuario de Instagram para gestionar la participación en el juego. Consulta la política de privacidad.': 'I agree that Stand and the organizer may process my email and, if provided, my Instagram username to manage my participation in the game. See the privacy policy.',
  'Registrando...': 'Registering...',
  'Empezar': 'Start',
  'Premio por pareja': 'Pair prize',
  'Premio del sorteo': 'Raffle prize',
  '¡Pareja válida!': 'Pair validated!',
  'Muestra este QR en el punto de recogida para canjear tu premio.': 'Show this QR code at the collection point to claim your prize.',
  'Mirad la pantalla del evento para ver el resultado en vivo.': 'Look at the event screen to see the live result.',
  'Cargando premios...': 'Loading prizes...',
  'Premio(s) ya recogido(s). ¡Disfrutad!': 'Prize(s) already collected. Enjoy!',
  'Validar otra pareja': 'Validate another pair',
  'No se pudo abrir tu acceso personal': 'Unable to open your personal access',
  'Envía el código': 'Send the code',
  'en el chat para recibir otro enlace.': 'in the chat to receive another link.',
  'Solicitar nuevo enlace en Instagram': 'Request a new Instagram link',
  'Participa desde Instagram': 'Join via Instagram',
  'Envía el código de la partida': 'Send the game code',
  'por mensaje directo a la cuenta de Instagram del evento para recibir tu enlace personal.': 'in a direct message to the event’s Instagram account to receive your personal link.',
  'Abrir Instagram': 'Open Instagram',
  'Juego no disponible': 'Game unavailable',
  'Este enlace no es válido o el juego no admite participación web todavía.': 'This link is invalid or the game does not support web participation yet.',
  'No se pudo cargar el juego': 'Unable to load the game',
  'Reintentar carga': 'Retry loading',
  'Consulta al equipo del evento': 'Ask the event team',
  'Acércate a la pantalla máster del evento y muestra tu código para jugar. El cronómetro se juega y valida allí, no desde el móvil.': 'Go to the event screen and show your code to play. The timer is played and validated there, not on your phone.',
  'El enlace o la sesión de participante no es válido.': 'The link or participant session is invalid.',
  'No se pudo recuperar tu participante. Solicita otro enlace por mensaje de Instagram.': 'Unable to recover your participant. Request another link via Instagram direct message.',
  'El enlace de acceso no es válido, ya se ha utilizado o ha caducado. Solicita un nuevo enlace por mensaje directo de Instagram.': 'The access link is invalid, has already been used or has expired. Request a new link via Instagram direct message.',
}

const ParticipantLanguageContext = createContext<{
  language: Language
  t: (text: string) => string
  setLanguage: (language: Language) => void
}>({
  language: 'es',
  t: (text: string) => text,
  setLanguage: () => {},
})

export function ParticipantLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('es')
  const t = (text: string) => language === 'en' ? translations[text] ?? text : text
  return (
    <ParticipantLanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </ParticipantLanguageContext.Provider>
  )
}

export function ParticipantLanguageSelector() {
  const { language, setLanguage } = useParticipantLanguage()
  return (
    <select
      aria-label={language === 'es' ? 'Idioma' : 'Language'}
      value={language}
      onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'es')}
      className="absolute right-3 top-3 z-20 rounded-lg border border-[rgba(var(--color-accent-rgb),0.35)] bg-surface px-2 py-1 text-sm text-accent"
    >
      <option value="es">ES</option>
      <option value="en">EN</option>
    </select>
  )
}

export function useParticipantLanguage() {
  return useContext(ParticipantLanguageContext)
}
