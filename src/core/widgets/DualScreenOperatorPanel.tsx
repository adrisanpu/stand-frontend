import { getDisplayUrl, getWebPlayUrl } from '../lib/joinUrl'

type Props = {
  gameId: string
  gameName: string
}

/** Operator center when joinChannel=web: links to public display + participant play. */
export default function DualScreenOperatorPanel({ gameId, gameName }: Props) {
  const displayUrl = getDisplayUrl(gameId)
  const playUrl = getWebPlayUrl(gameId)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 text-center max-w-lg mx-auto">
      <h2 className="text-xl font-bold">Modo pantalla dual</h2>
      <p className="text-sm text-textSub">
        Los participantes juegan desde el móvil. Abre la pantalla pública en el monitor o proyector.
      </p>
      <div className="w-full space-y-3">
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl py-3 px-4 font-semibold bg-[rgba(34,211,238,0.2)] border border-[rgba(34,211,238,0.35)]"
        >
          Abrir pantalla pública
        </a>
        <button
          type="button"
          onClick={() => void copy(displayUrl)}
          className="block w-full rounded-xl py-2 text-sm border border-white/15"
        >
          Copiar enlace pantalla pública
        </button>
        <button
          type="button"
          onClick={() => void copy(playUrl)}
          className="block w-full rounded-xl py-2 text-sm border border-white/15"
        >
          Copiar enlace participante
        </button>
      </div>
      <p className="text-xs text-textSub">
        Partida: {gameName} · {gameId}
      </p>
    </div>
  )
}
