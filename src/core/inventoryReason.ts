export function inventoryReasonText(reason: string, language: 'es' | 'en'): string {
  const normalized = reason.toLowerCase()
  if (normalized.includes('uninitialized') || normalized.includes('not_initialized') || normalized.includes('notinitialized')) {
    return language === 'en' ? 'Prize stock has not been initialized.' : 'El stock del premio no está inicializado.'
  }
  if (normalized.includes('cap') || normalized.includes('limit')) {
    return language === 'en' ? 'The event prize cap has been reached.' : 'Se ha alcanzado el límite de premios de esta partida.'
  }
  if (normalized.includes('exhausted') || normalized.includes('out_of_stock') || normalized.includes('outofstock') || normalized.includes('insufficient_stock')) {
    return language === 'en' ? 'Shared prize stock is exhausted.' : 'Se ha agotado el stock compartido del premio.'
  }
  return language === 'en' ? 'This prize is currently unavailable. Ask the event team.' : 'Este premio no está disponible ahora. Consulta al equipo del evento.'
}
