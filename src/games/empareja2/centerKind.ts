/** What EMPAREJA2 shows in the operator center panel. */
export type Empareja2CenterKind = 'pair' | 'avatar' | 'links'

/**
 * Teléfonos (`web`) → avatar (or dual-screen links if avatars off).
 * Pantalla del evento (`instagram` / other) → pair validation UI.
 */
export function getEmpareja2CenterKind(
  joinChannel: string | null | undefined,
  avatarsEnabled: boolean,
): Empareja2CenterKind {
  if ((joinChannel || '').toLowerCase() === 'web') {
    return avatarsEnabled ? 'avatar' : 'links'
  }
  return 'pair'
}
