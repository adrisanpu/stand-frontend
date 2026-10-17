export type PlayMode = 'master' | 'mobile'
export type JoinChannel = 'instagram' | 'web'
export type GameAccess = { playMode: PlayMode; joinChannel: JoinChannel }
type AccessInput = { playMode?: unknown; joinChannel?: unknown }

export const GAME_ACCESS_CAPABILITIES: Record<string, {
  playModes: readonly PlayMode[]
  joinChannels: readonly JoinChannel[]
}> = {
  EMPAREJA2: { playModes: ['master', 'mobile'], joinChannels: ['instagram', 'web'] },
  T1MER: { playModes: ['master', 'mobile'], joinChannels: ['instagram', 'web'] },
  STACK: { playModes: ['mobile'], joinChannels: ['instagram', 'web'] },
  L3TRAS: { playModes: ['master'], joinChannels: ['instagram'] },
  RULET4: { playModes: ['master'], joinChannels: ['instagram'] },
  CUPIDO: { playModes: ['master'], joinChannels: ['instagram'] },
  SEMAFORO: { playModes: ['master'], joinChannels: ['instagram'] },
  INFOCARDS: { playModes: ['master'], joinChannels: ['instagram'] },
  IMPOSTOR: { playModes: ['master'], joinChannels: ['instagram'] },
}

export function resolveGameAccess(gameType: string, settings?: AccessInput | null): GameAccess {
  const type = gameType.toUpperCase()
  const capabilities = GAME_ACCESS_CAPABILITIES[type]
  if (!capabilities) throw new Error(`Juego no compatible: ${gameType}`)
  const defaultChannel = capabilities.joinChannels.includes('web') ? 'web' : 'instagram'
  const joinChannel = settings?.joinChannel == null ? defaultChannel : settings.joinChannel
  if (joinChannel !== 'web' && joinChannel !== 'instagram') throw new Error('Canal de acceso no válido.')
  const playMode = settings?.playMode ?? (
    type === 'STACK' || ((type === 'EMPAREJA2' || type === 'T1MER') && joinChannel === 'web')
      ? 'mobile' : 'master'
  )
  if (playMode !== 'master' && playMode !== 'mobile') throw new Error('Modo de juego no válido.')
  if (!capabilities.playModes.includes(playMode) || !capabilities.joinChannels.includes(joinChannel)) {
    throw new Error('Esta combinación de modo y acceso no está disponible para el juego.')
  }
  return { playMode, joinChannel }
}
