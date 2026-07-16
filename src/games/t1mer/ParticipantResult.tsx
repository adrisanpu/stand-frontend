type Props = {
  time: number
  difference: number
  rank: number | null
  onPlayAgain: () => void
}

function formatDiff(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`
}

export default function T1merParticipantResult({ time, difference, rank, onPlayAgain }: Props) {
  const scoreMs = Math.round(difference * 1000)
  return (
    <div className="card p-6 text-center space-y-4">
      <h2 className="text-2xl font-bold">¡Hecho!</h2>
      <div className="space-y-1">
        <p className="text-sm text-textSub">Tu tiempo</p>
        <p className="text-3xl font-mono font-bold tabular-nums">{time.toFixed(3)} s</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-textSub">Diferencia vs 10.000 s</p>
        <p className="text-xl font-semibold">{formatDiff(scoreMs)}</p>
      </div>
      {rank != null && (
        <p className="text-lg">
          Posición: <span className="font-bold">#{rank}</span>
        </p>
      )}
      <p className="text-sm text-textSub">Mira el ranking en la pantalla del evento.</p>
      <button
        type="button"
        onClick={onPlayAgain}
        className="w-full rounded-xl py-3 font-semibold bg-[rgba(239,68,68,0.25)] border border-[rgba(239,68,68,0.4)]"
      >
        Jugar otra vez
      </button>
    </div>
  )
}
