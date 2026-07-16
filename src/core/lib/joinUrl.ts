import { getInstagramDmUrl } from './instagram'

/** Participant join URL for web-first campaigns. */
export function getWebPlayUrl(gameId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://playstand.app'
  return `${base}/play/${encodeURIComponent(gameId.trim())}`
}

export function getDisplayUrl(gameId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://playstand.app'
  return `${base}/display/${encodeURIComponent(gameId.trim())}`
}

export function getRedeemUrl(gameId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://playstand.app'
  return `${base}/redeem/${encodeURIComponent(gameId.trim())}`
}

/** QR target: web play or Instagram DM depending on campaign join channel. */
export function getJoinUrl(gameId: string, joinChannel?: string | null): string {
  if ((joinChannel || 'web').toLowerCase() === 'instagram') {
    return getInstagramDmUrl(gameId)
  }
  return getWebPlayUrl(gameId)
}
