export function formatTimer(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const centiseconds = Math.floor((seconds % 1) * 100)
  const milliseconds = Math.floor(((seconds % 1) * 1000) % 10)
  return `${String(totalSeconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}.${String(milliseconds)}`
}

export function timerDifference(seconds: number): number {
  return Math.abs(seconds - 10)
}
