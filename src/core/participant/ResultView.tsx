type Props = {
  gameId: string
  onPlayAgain: () => void
}

export default function ResultView({ onPlayAgain }: Props) {
  return (
    <div className="card p-6 text-center space-y-4">
      <div className="text-5xl" aria-hidden>✓</div>
      <h2 className="text-2xl font-bold text-green-300">¡Pareja válida!</h2>
      <p className="text-textSub">
        Mirad la pantalla del evento para ver el resultado en vivo.
      </p>
      <button
        type="button"
        onClick={onPlayAgain}
        className="w-full rounded-xl py-3 font-semibold border border-white/15"
      >
        Validar otra pareja
      </button>
    </div>
  )
}
