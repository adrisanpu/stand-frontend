import type { PlayerAssignment } from '../../api/publicApi'

const TOKEN_KEY = 'stand_player_token'
const ASSIGNMENT_KEY = 'stand_player_assignment'

function sessionKey(gameId: string, suffix: string) {
  return `${suffix}_${gameId}`
}

export function savePlayerSession(gameId: string, playerToken: string, assignment: PlayerAssignment) {
  sessionStorage.setItem(sessionKey(gameId, TOKEN_KEY), playerToken)
  sessionStorage.setItem(sessionKey(gameId, ASSIGNMENT_KEY), JSON.stringify(assignment))
}

export function loadPlayerToken(gameId: string): string | null {
  return sessionStorage.getItem(sessionKey(gameId, TOKEN_KEY))
}

export function loadAssignment(gameId: string): PlayerAssignment | null {
  const raw = sessionStorage.getItem(sessionKey(gameId, ASSIGNMENT_KEY))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PlayerAssignment
  } catch {
    return null
  }
}

export function clearPlayerSession(gameId: string) {
  sessionStorage.removeItem(sessionKey(gameId, TOKEN_KEY))
  sessionStorage.removeItem(sessionKey(gameId, ASSIGNMENT_KEY))
}
