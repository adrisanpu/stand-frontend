const ALIASES: Record<string, string> = {
  TIMER: 'T1MER',
  RULETA: 'RULET4',
  EMPAREJA: 'EMPAREJA2',
  SEMAFORO: 'SEMAFORO',
  'SEMÁFORO': 'SEMAFORO',
}

/** Map backend / human game type strings to canonical uppercase game ids */
export function normalizeGameType(type: string | undefined): string {
  if (!type) return 'EMPAREJA2'
  const upper = type.trim().toUpperCase()
  return ALIASES[upper] ?? upper
}

/** @deprecated Use normalizeGameType */
export const mapGameTypeToId = normalizeGameType
