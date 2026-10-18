export type PlayMode = 'mobile'
export type JoinChannel = 'web'
export type GameAccess = { playMode: PlayMode; joinChannel: JoinChannel }
type AccessInput = { playMode?: unknown; joinChannel?: unknown }

export const GAME_ACCESS_CAPABILITIES: Record<string, {
  playModes: readonly PlayMode[]
  joinChannels: readonly JoinChannel[]
}> = {
  EMPAREJA2: { playModes: ['mobile'], joinChannels: ['web'] },
  T1MER: { playModes: ['mobile'], joinChannels: ['web'] },
  STACK: { playModes: ['mobile'], joinChannels: ['web'] },
  L3TRAS: { playModes: ['mobile'], joinChannels: ['web'] },
  RULET4: { playModes: ['mobile'], joinChannels: ['web'] },
  CUPIDO: { playModes: ['mobile'], joinChannels: ['web'] },
  SEMAFORO: { playModes: ['mobile'], joinChannels: ['web'] },
  INFOCARDS: { playModes: ['mobile'], joinChannels: ['web'] },
  IMPOSTOR: { playModes: ['mobile'], joinChannels: ['web'] },
}

/** Legacy and malformed access settings are normalized to the sole supported configuration. */
export function resolveGameAccess(gameType: string, _settings?: AccessInput | null): GameAccess {
  const type = gameType.toUpperCase()
  if (!GAME_ACCESS_CAPABILITIES[type]) throw new Error(`Juego no compatible: ${gameType}`)
  return { playMode: 'mobile', joinChannel: 'web' }
}
