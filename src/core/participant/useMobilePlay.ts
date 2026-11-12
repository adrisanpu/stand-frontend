import { useCallback, useEffect, useRef, useState } from 'react'
import { isMobileAssignment, PublicApiError, publicApi, type MobileAssignment, type MobileMove } from '../../api/publicApi'

export type MobilePlayProps = { gameId: string; playerToken: string; initialAssignment: MobileAssignment }
export const mobileActionClass = 'w-full min-h-12 rounded-xl border border-primary/40 bg-primary/20 px-4 py-3 font-semibold text-primary disabled:opacity-50'
const errors: Record<string, string> = {
  CodeNotFound: 'Ese código no existe en esta partida.',
  CodeAlreadyUsed: 'Ya has añadido ese código.',
  LetterNotNeeded: 'Esa letra no tiene un hueco libre en la palabra.',
  SameCode: 'Introduce el código de otra persona.',
  AlreadyValidated: 'Un participante ya está validado. Comprueba el estado recuperado.',
  PlayChanged: 'La partida ha cambiado. Comprueba el estado recuperado y reintenta.',
  PartnerQuizRequired: 'Tu pareja debe completar el cuestionario primero.',
  MustIncludeOwnCode: 'Incluye tu código para completar la palabra.',
  InvalidCode: 'El código debe tener cuatro dígitos.',
  QuizRequired: 'Completa el cuestionario antes de jugar.',
  GameInactive: 'Juego no disponible',
  CardsUnavailable: 'Las tarjetas no están disponibles. Reintenta más tarde.',
  InvalidPlayerToken: 'El enlace o la sesión de participante no es válido.',
  TurnNotExpired: 'El turno sigue activo. Elige una respuesta.',
  AlreadyFinished: 'La partida ya ha terminado.',
}
function message(error: unknown) {
  if (error instanceof PublicApiError && error.code && errors[error.code]) return errors[error.code]
  return error instanceof Error ? error.message : 'No se pudo confirmar la acción.'
}

export function useMobilePlay({ gameId, playerToken, initialAssignment }: MobilePlayProps) {
  const [assignment, setAssignment] = useState(initialAssignment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  const retryMove = useRef<{ move: MobileMove; revision: number; requestId: string } | null>(null)
  const apply = useCallback((next: unknown) => {
    if (!isMobileAssignment(next as MobileAssignment) || (next as MobileAssignment).gameType !== initialAssignment.gameType
      || (next as MobileAssignment).playerId !== initialAssignment.playerId) {
      throw new Error('No se pudo recuperar el juego.')
    }
    if (mounted.current) setAssignment(next as MobileAssignment)
  }, [initialAssignment.gameType, initialAssignment.playerId])
  const refresh = useCallback(async () => {
    if (lock.current) return
    lock.current = true
    if (mounted.current) { setBusy(true); setError(null) }
    try {
      const response = await publicApi.getPlayer(playerToken, gameId)
      apply(response.assignment)
      retryMove.current = null
      if (mounted.current) setLoaded(true)
    } catch (e) {
      if (mounted.current) setError(message(e))
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }, [gameId, playerToken, apply])
  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => { mounted.current = false }
  }, [refresh])
  const send = async (move: MobileMove) => {
    if (lock.current || !loaded) return
    lock.current = true
    setBusy(true)
    setError(null)
    const pending = retryMove.current ?? {
      move, revision: assignment.play.revision,
      requestId: crypto.randomUUID(),
    }
    retryMove.current = pending
    try {
      const response = await publicApi.play(gameId, playerToken, pending.revision, pending.requestId, pending.move)
      apply(response.assignment)
      retryMove.current = null
      return true
    } catch (e) {
      if (e instanceof PublicApiError && e.status < 500 && e.status !== 408 && e.status !== 429) {
        retryMove.current = null
        if (e.code === 'PlayChanged' || e.code === 'AlreadyValidated' || e.code === 'AlreadyFinished') {
          const response = await publicApi.getPlayer(playerToken, gameId).catch(() => null)
          if (response) apply(response.assignment)
        }
      }
      if (mounted.current) setError(message(e))
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
    return false
  }
  return { assignment, busy, error, loaded, send, refresh, pending: Boolean(retryMove.current) }
}

export function useRemaining(expiresAt?: number, serverNow?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const offset = serverNow ? serverNow - Date.now() : 0
    setNow(Date.now() + offset)
    if (!expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now() + offset), 200)
    return () => window.clearInterval(timer)
  }, [expiresAt, serverNow])
  return expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
}
