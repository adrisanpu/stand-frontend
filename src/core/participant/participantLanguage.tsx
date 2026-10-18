import { createContext, useContext, useState, type ReactNode } from 'react'

type Language = 'es' | 'en'
const translations: Record<string, string> = {
  'Enviar código': 'Send code',
  'Enviando código...': 'Sending code...',
  'Código enviado a': 'Code sent to',
  'Código de verificación': 'Verification code',
  'Verificar y empezar': 'Verify and start',
  'Reenviar código': 'Resend code',
  'Cambiar datos': 'Change details',
  'Puedes solicitar otro código en': 'You can request another code in',
  'No se pudo completar el registro. Inténtalo de nuevo más tarde.': 'Unable to complete registration. Please try again later.',
  'No se pudo enviar el registro. Revisa tus datos e inténtalo de nuevo.': 'Unable to submit registration. Check your details and try again.',
  'La configuración del formulario ha cambiado. Recarga la página para registrarte.': 'The form configuration has changed. Reload the page to register.',
  'No se encuentra el juego. Revisa el enlace de participación.': 'Game not found. Check your participation link.',
  'El juego no está activo. Consulta al equipo del evento.': 'The game is not active. Ask the event team.',
  'El registro web no está disponible para este juego. Consulta al equipo del evento.': 'Web registration is unavailable for this game. Ask the event team.',
  'Introduce un email válido.': 'Enter a valid email address.',
  'Introduce un teléfono válido.': 'Enter a valid phone number.',
  'El juego ha alcanzado el límite de participantes. Consulta al equipo del evento.': 'The game has reached its participant limit. Ask the event team.',
  'El código caduca en 10 minutos. Tienes 5 intentos.': 'The code expires in 10 minutes. You have 5 attempts.',
  'Introduce los 6 dígitos del email.': 'Enter the 6 digits from the email.',
  'Introduce un código de 6 dígitos.': 'Enter a 6-digit code.',
  'Solicita un código para verificar tu email.': 'Request a code to verify your email.',
  'El código no es correcto. Inténtalo de nuevo.': 'The code is incorrect. Try again.',
  'El código ha caducado. Solicita uno nuevo.': 'The code has expired. Request a new one.',
  'Has agotado los 5 intentos. Solicita un código nuevo.': 'You have used all 5 attempts. Request a new code.',
  'Este código ha sido reemplazado. Solicita uno nuevo.': 'This code has been replaced. Request a new one.',
  'Este código ya se ha utilizado. Solicita uno nuevo.': 'This code has already been used. Request a new one.',
  'Demasiadas solicitudes. Espera antes de solicitar otro código.': 'Too many requests. Wait before requesting another code.',
  'No se pudo enviar el email. Inténtalo de nuevo.': 'Unable to send the email. Try again.',
  'La verificación por email no está disponible. Inténtalo más tarde.': 'Email verification is unavailable. Try again later.',
  'Premios en juego': 'Prizes to play for',
  'PREMIO': 'PRIZE',
  'PREMIO TOP': 'TOP PRIZE',
  'Premio del ranking': 'Leaderboard prize',
  'No se pudieron actualizar los premios.': 'Unable to refresh prizes.',
  'Reintentar actualización de premios': 'Retry refreshing prizes',
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
  'El teléfono es obligatorio.': 'Phone number is required.',
  'Teléfono': 'Phone',
  'Debes aceptar la política de privacidad.': 'You must accept the privacy policy.',
  'Error al registrarse': 'Registration failed',
  'Regístrate para jugar desde tu móvil': 'Register to play on your phone',
  ' (opcional)': ' (optional)',
  'tu@email.com': 'you@email.com',
  '@usuario': '@username',
  'Política de privacidad': 'Privacy policy',
  'Acepto que Stand y el organizador usen mis datos y, si subo una foto, la muestren en el juego.': 'I agree that Stand and the organizer may use my data and, if I upload a photo, display it in the game.',
  'Foto de perfil (opcional)': 'Profile photo (optional)',
  'Nombre de usuario': 'Username',
  'El nombre de usuario es obligatorio.': 'Username is required.',
  'Usa un nombre de usuario de hasta 100 caracteres sin caracteres de control.': 'Use a username of up to 100 characters without control characters.',
  'Usa una imagen JPG, PNG o WebP de hasta 5 MB.': 'Choose a JPG, PNG, or WebP image up to 5 MB.',
  'No se pudo guardar la foto; se muestra el avatar genérico.': 'The photo could not be saved; the default avatar is shown.',
  'Registrando...': 'Registering...',
  'Empezar': 'Start',
  '¡Ya estás dentro!': 'You’re in!',
  'Sigue las instrucciones del evento para jugar.': 'Follow the event instructions to play.',
  'Premio por pareja': 'Pair prize',
  'Premio del sorteo': 'Raffle prize',
  '¡Pareja válida!': 'Pair validated!',
  'Muestra este QR en el punto de recogida para canjear tu premio.': 'Show this QR code at the collection point to claim your prize.',
  'Mirad la pantalla del evento para ver el resultado en vivo.': 'Look at the event screen to see the live result.',
  'Cargando premios...': 'Loading prizes...',
  'Premio(s) ya recogido(s). ¡Disfrutad!': 'Prize(s) already collected. Enjoy!',
  'Validar otra pareja': 'Validate another pair',
  'Juego no disponible': 'Game unavailable',
  'Este enlace no es válido o el juego no admite participación web todavía.': 'This link is invalid or the game does not support web participation yet.',
  'No se pudo cargar el juego': 'Unable to load the game',
  'Reintentar carga': 'Retry loading',
  'Consulta al equipo del evento': 'Ask the event team',
  'El enlace o la sesión de participante no es válido.': 'The link or participant session is invalid.',
  'No se pudo recuperar tu participante. Solicita un nuevo enlace de participación.': 'Unable to recover your participant. Request a new participation link.',
  'No se pudo recuperar tu participante.': 'Unable to recover your participant.',
  'Díselo al equipo del evento para entrar en la partida.': 'Tell the event team to join the game.',
  'No se pudo actualizar la partida. Reintentando...': 'Unable to update the game. Retrying...',
  'Estás en la lista. Espera a que empiece la partida.': 'You are on the list. Wait for the game to start.',
  'La ronda ya ha empezado. Entrarás en la siguiente.': 'The round has already started. You will join the next one.',
  'Eres el impostor': 'You are the impostor',
  'No conoces la palabra. Disimula para que no te descubran.': 'You do not know the word. Blend in so nobody finds you out.',
  'Tu palabra': 'Your word',
  'No enseñes tu pantalla a los demás jugadores.': 'Do not show your screen to other players.',
  '¡Te toca! Di una palabra en voz alta.': 'Your turn! Say a word out loud.',
  'Turno de': 'Turn:',
  'Votación: di al equipo del evento quién crees que es el impostor.': 'Voting: tell the event team who you think the impostor is.',
  'Ganan los jugadores': 'The players win',
  'Gana el impostor': 'The impostor wins',
  '¡Has ganado!': 'You won!',
  'Has perdido': 'You lost',
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
      className="absolute right-3 top-3 z-50 pointer-events-auto rounded-lg border border-[rgba(var(--color-accent-rgb),0.35)] bg-[var(--color-background,#0B0A12)] px-2 py-1 text-sm text-accent"
    >
      <option value="es">ES</option>
      <option value="en">EN</option>
    </select>
  )
}

export function useParticipantLanguage() {
  return useContext(ParticipantLanguageContext)
}
