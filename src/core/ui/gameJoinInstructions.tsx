import type { ReactNode } from 'react'
import { LandscapeInfoInstruction } from '../widgets/GameLandscapeInfoColumn'
import { normalizeGameType } from '../gameTypeMap'

const INSTRUCTIONS: Record<string, ReactNode> = {
  T1MER: (
    <>
      <LandscapeInfoInstruction>Escanea el QR y pulsa JUGAR.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Ingresa tu código y valida.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>El temporizador se oculta a los 5 s.</LandscapeInfoInstruction>
      <LandscapeInfoInstruction>Detén en 10 segundos.</LandscapeInfoInstruction>
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

export function getJoinInstructions(gameId: string): ReactNode {
  const key = normalizeGameType(gameId)
  return INSTRUCTIONS[key] ?? null
}
