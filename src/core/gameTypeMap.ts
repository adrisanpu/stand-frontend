/** Map backend / human game type strings to canonical frontend game ids */
export function mapGameTypeToId(type: string | undefined): string {
  if (!type) return 'empareja2'
  const normalized = type.toLowerCase()
  if (normalized === 't1mer' || normalized === 'timer') return 't1mer'
  if (normalized === 'empareja2' || normalized === 'empareja') return 'empareja2'
  if (normalized === 'rulet4' || normalized === 'ruleta') return 'rulet4'
  if (normalized === 'cupido') return 'cupido'
  if (normalized === 'semaforo' || normalized === 'semáforo') return 'semaforo'
  if (normalized === 'infocards') return 'infocards'
  return normalized
}
