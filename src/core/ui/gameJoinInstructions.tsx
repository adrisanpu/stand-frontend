import type { ReactNode } from 'react'
import { LandscapeInfoInstruction } from '../widgets/GameLandscapeInfoColumn'
import { normalizeGameType } from '../gameTypeMap'
import type { GameAccess } from '../settings/gameAccess'

const INSTRUCTIONS: Record<string, ReactNode> = {
  STACK: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y regístrate desde tu móvil.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Toca el bloque o pulsa COLOCAR para apilar. Las partes que sobresalen se cortan.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Solo tienes un intento; se consume al pulsar EMPEZAR. Recargar no permite repetir.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>El servidor valida tu partida y guarda la puntuación en el ranking al terminar.</LandscapeInfoInstruction>
    </>
  ),
  T1MER: (
    <>
      <LandscapeInfoInstruction>Escanea el QR con tu móvil para registrarte.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Juega el timer en el teléfono: empieza y detén cerca de 10 s.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>El temporizador se oculta a los 5 segundos.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Tu posición aparece en el ranking de esta pantalla.</LandscapeInfoInstruction>
    </>
  ),
  RULET4: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR en el chat de Instagram.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Recibe tu código de jugador por DM.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Ingresa y valida tu código.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Tienes una tirada de la ruleta.</LandscapeInfoInstruction>
    </>
  ),
  L3TRAS: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR en el chat de Instagram.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Cada jugador recibirá un código de validación asociado a una letra.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Reuníos; cada participante tendrá su propio código.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Formad la palabra objetivo antes que el resto.</LandscapeInfoInstruction>
    </>
  ),
  EMPAREJA2: (
    <>
      <LandscapeInfoInstruction>Escanea el QR con tu móvil para registrarte.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Recibe tu personaje, pareja y código de validación.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Encuentra a tu pareja en la sala.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Validad los dos códigos desde el móvil; el resultado aparece aquí.</LandscapeInfoInstruction>
    </>
  ),
  CUPIDO: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR en el chat de Instagram.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Cupido te empareja con alguien de gustos afines (pareja o amigos).</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Encuentra a tu pareja y validad juntos vuestros códigos aquí.</LandscapeInfoInstruction>
    </>
  ),
  SEMAFORO: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR en el chat de Instagram.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Te asignamos a un grupo: Casado, Puede ser o Soltero.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Aquí ves cuánta gente hay en cada grupo.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Cuando os encontréis, validad juntos vuestros códigos aquí.</LandscapeInfoInstruction>
    </>
  ),
  INFOCARDS: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR en el chat de Instagram para unirte.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>En el chat podrás hacer un pequeño quiz y demostrar lo aprendido.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Participa en los sorteos.</LandscapeInfoInstruction>
    </>
  ),
  IMPOSTOR: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y entra en la partida desde Instagram.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Valida tu código para aparecer en la lista de jugadores.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Di una palabra en voz alta cuando llegue tu turno.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Vota quién crees que es el impostor.</LandscapeInfoInstruction>
    </>
  ),
}

export function getJoinInstructions(gameId: string, access?: GameAccess): ReactNode {
  const key = normalizeGameType(gameId)
  if (access && (key === 'EMPAREJA2' || key === 'T1MER' || key === 'STACK')) {
    return (
      <>
        <LandscapeInfoInstruction>
          {access.joinChannel === 'instagram'
            ? 'Escanea el QR y pulsa JUGAR en Instagram.'
            : 'Escanea el QR y completa el formulario web.'}
        </LandscapeInfoInstruction>
        {access.joinChannel === 'instagram' && access.playMode === 'mobile' && (
          <LandscapeInfoInstruction>Recibirás un enlace personal por DM para jugar desde tu móvil.</LandscapeInfoInstruction>
        )}
        {key === 'EMPAREJA2' ? (
          <>
            <LandscapeInfoInstruction>Recibe tu personaje y código, y encuentra a tu pareja.</LandscapeInfoInstruction>
            <LandscapeInfoInstruction>
              {access.playMode === 'mobile' ? 'Validad los dos códigos desde el móvil.' : 'Introducid los dos códigos en la pantalla máster para validar.'}
            </LandscapeInfoInstruction>
          </>
        ) : key === 'T1MER' ? (
          <LandscapeInfoInstruction>
            {access.playMode === 'mobile'
              ? 'Juega el timer en el móvil: detén el temporizador cerca de 10 segundos.'
              : 'Introduce tu código en la pantalla máster y detén el temporizador cerca de 10 segundos.'}
          </LandscapeInfoInstruction>
        ) : (
          <LandscapeInfoInstruction>Apila bloques desde el móvil. Tu único intento se consume al pulsar EMPEZAR.</LandscapeInfoInstruction>
        )}
      </>
    )
  }
  return INSTRUCTIONS[key] ?? null
}
