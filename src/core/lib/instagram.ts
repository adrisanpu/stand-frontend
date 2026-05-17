/**
 * Instagram DM link for Stand: ig.me/m/playstand_
 * When gameId is provided, appends ?ref=gameId so the webhook can assign the user to that game
 * after they tap the Ice Breaker "JUGAR".
 */
export const INSTAGRAM_HANDLE = 'playstand_'

export function getInstagramDmUrl(gameId?: string | null): string {
  const base = `https://ig.me/m/${INSTAGRAM_HANDLE}`
  if (gameId && gameId.trim()) {
    return `${base}?ref=${encodeURIComponent(gameId.trim())}`
  }
  return base
}
