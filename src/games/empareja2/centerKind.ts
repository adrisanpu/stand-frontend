/** What EMPAREJA2 shows in the operator center panel. */
export type Empareja2CenterKind = 'pair' | 'avatar' | 'links'

export function getEmpareja2CenterKind(
  playMode: 'master' | 'mobile',
  avatarsEnabled: boolean,
): Empareja2CenterKind {
  if (playMode === 'mobile') {
    return avatarsEnabled ? 'avatar' : 'links'
  }
  return 'pair'
}
