import type { ReactNode } from 'react'
import { LandscapeInfoInstruction } from '../widgets/GameLandscapeInfoColumn'
import { normalizeGameType } from '../gameTypeMap'
import type { GameAccess } from '../settings/gameAccess'

type Translate = (spanish: string, english?: string) => string
const spanishOnly: Translate = (spanish) => spanish

export function getJoinInstructions(gameId: string, access?: GameAccess, t: Translate = spanishOnly): ReactNode {
  const key = normalizeGameType(gameId)
  if (access && (key === 'EMPAREJA2' || key === 'T1MER' || key === 'STACK')) {
    return (
      <>
        <LandscapeInfoInstruction>
          {access.joinChannel === 'instagram'
            ? t('Escanea el QR y pulsa JUGAR en Instagram.', 'Scan the QR code and tap PLAY on Instagram.')
            : t('Escanea el QR y completa el formulario web.', 'Scan the QR code and complete the web form.')}
        </LandscapeInfoInstruction>
        {access.joinChannel === 'instagram' && access.playMode === 'mobile' && (
          <LandscapeInfoInstruction>{t('Recibirás un enlace personal por DM para jugar desde tu móvil.', 'You will receive a personal link by DM to play on your phone.')}</LandscapeInfoInstruction>
        )}
        {key === 'EMPAREJA2' ? (
          <>
            <LandscapeInfoInstruction>{t('Recibe tu personaje y código, y encuentra a tu pareja.', 'Get your character and code, then find your partner.')}</LandscapeInfoInstruction>
            <LandscapeInfoInstruction>
              {access.playMode === 'mobile'
                ? t('Validad los dos códigos desde el móvil.', 'Validate both codes on your phone.')
                : t('Introducid los dos códigos en la pantalla máster para validar.', 'Enter both codes on the master screen to validate them.')}
            </LandscapeInfoInstruction>
          </>
        ) : key === 'T1MER' ? (
          <LandscapeInfoInstruction>
            {access.playMode === 'mobile'
              ? t('Juega el timer en el móvil: detén el temporizador cerca de 10 segundos.', 'Play the timer on your phone: stop it close to 10 seconds.')
              : t('Introduce tu código en la pantalla máster y detén el temporizador cerca de 10 segundos.', 'Enter your code on the master screen and stop the timer close to 10 seconds.')}
          </LandscapeInfoInstruction>
        ) : (
          <LandscapeInfoInstruction>{t('Apila bloques desde el móvil. Tu único intento se consume al pulsar EMPEZAR.', 'Stack blocks on your phone. Your only attempt is used when you tap START.')}</LandscapeInfoInstruction>
        )}
      </>
    )
  }
  const instructionTranslations: Record<string, Array<[string, string]>> = {
    STACK: [
      ['Escanea el QR y regístrate desde tu móvil.', 'Scan the QR code and register on your phone.'],
      ['Toca el bloque o pulsa COLOCAR para apilar. Las partes que sobresalen se cortan.', 'Tap the block or press PLACE to stack. Overhanging parts are cut off.'],
      ['Solo tienes un intento; se consume al pulsar EMPEZAR. Recargar no permite repetir.', 'You only get one attempt; it is used when you press START. Reloading will not let you try again.'],
      ['El servidor valida tu partida y guarda la puntuación en el ranking al terminar.', 'The server validates your game and saves your score to the leaderboard when you finish.'],
    ],
    T1MER: [
      ['Escanea el QR con tu móvil para registrarte.', 'Scan the QR code with your phone to register.'],
      ['Juega el timer en el teléfono: empieza y detén cerca de 10 s.', 'Play the timer on your phone: start and stop it close to 10 seconds.'],
      ['El temporizador se oculta a los 5 segundos.', 'The timer is hidden after 5 seconds.'],
      ['Tu posición aparece en el ranking de esta pantalla.', 'Your position appears on this screen’s leaderboard.'],
    ],
    RULET4: [
      ['Escanea el QR y pulsa JUGAR en el chat de Instagram.', 'Scan the QR code and tap PLAY in the Instagram chat.'],
      ['Recibe tu código de jugador por DM.', 'Receive your player code by DM.'],
      ['Ingresa y valida tu código.', 'Enter and validate your code.'],
      ['Tienes una tirada de la ruleta.', 'You get one spin of the wheel.'],
    ],
    L3TRAS: [
      ['Escanea el QR y pulsa JUGAR en el chat de Instagram.', 'Scan the QR code and tap PLAY in the Instagram chat.'],
      ['Cada jugador recibirá un código de validación asociado a una letra.', 'Each player receives a validation code associated with a letter.'],
      ['Reuníos; cada participante tendrá su propio código.', 'Gather together; each participant will have their own code.'],
      ['Formad la palabra objetivo antes que el resto.', 'Form the target word before everyone else.'],
    ],
    EMPAREJA2: [
      ['Escanea el QR con tu móvil para registrarte.', 'Scan the QR code with your phone to register.'],
      ['Recibe tu personaje, pareja y código de validación.', 'Get your character, partner, and validation code.'],
      ['Encuentra a tu pareja en la sala.', 'Find your partner in the room.'],
      ['Validad los dos códigos desde el móvil; el resultado aparece aquí.', 'Validate both codes on your phone; the result appears here.'],
    ],
    CUPIDO: [
      ['Escanea el QR y pulsa JUGAR en el chat de Instagram.', 'Scan the QR code and tap PLAY in the Instagram chat.'],
      ['Cupido te empareja con alguien de gustos afines (pareja o amigos).', 'Cupid matches you with someone who shares your interests (as a couple or friends).'],
      ['Encuentra a tu pareja y validad juntos vuestros códigos aquí.', 'Find your match and validate your codes together here.'],
    ],
    SEMAFORO: [
      ['Escanea el QR y pulsa JUGAR en el chat de Instagram.', 'Scan the QR code and tap PLAY in the Instagram chat.'],
      ['Te asignamos a un grupo: Casado, Puede ser o Soltero.', 'You will be assigned to a group: Married, Maybe, or Single.'],
      ['Aquí ves cuánta gente hay en cada grupo.', 'Here you can see how many people are in each group.'],
      ['Cuando os encontréis, validad juntos vuestros códigos aquí.', 'When you meet, validate your codes together here.'],
    ],
    INFOCARDS: [
      ['Escanea el QR y pulsa JUGAR en el chat de Instagram para unirte.', 'Scan the QR code and tap PLAY in the Instagram chat to join.'],
      ['En el chat podrás hacer un pequeño quiz y demostrar lo aprendido.', 'In the chat, you can take a short quiz and show what you have learned.'],
      ['Participa en los sorteos.', 'Take part in the raffles.'],
    ],
    IMPOSTOR: [
      ['Escanea el QR y entra en la partida desde Instagram.', 'Scan the QR code and join the game from Instagram.'],
      ['Valida tu código para aparecer en la lista de jugadores.', 'Validate your code to appear in the player list.'],
      ['Di una palabra en voz alta cuando llegue tu turno.', 'Say a word out loud when it is your turn.'],
      ['Vota quién crees que es el impostor.', 'Vote for who you think is the impostor.'],
    ],
  }
  const instructionSet = instructionTranslations[key]
  if (!instructionSet) return null
  return (
    <>
      {instructionSet.map(([spanish, english], index) => (
        <LandscapeInfoInstruction key={`${key}-${index}`}>{t(spanish, english)}</LandscapeInfoInstruction>
      ))}
    </>
  )
}
