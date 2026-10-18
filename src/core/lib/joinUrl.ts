/** Participant join URL for web-first campaigns. */
export function getWebPlayUrl(gameId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://playstand.app'
  return `${base}/play/${encodeURIComponent(gameId.trim())}`
}

export function getRedeemUrl(gameId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://playstand.app'
  return `${base}/redeem/${encodeURIComponent(gameId.trim())}`
}

/** QR target for all supported participant access. */
export function getJoinUrl(gameId: string, _joinChannel?: string | null): string {
  return getWebPlayUrl(gameId)
}
