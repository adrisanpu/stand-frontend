import { useState } from 'react'
import { getWebPlayUrl } from '../lib/joinUrl'

type Props = {
  gameId: string
  gameName: string
}

export default function MobileParticipantsPanel({ gameId, gameName }: Props) {
  const playUrl = getWebPlayUrl(gameId)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(playUrl)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 text-center max-w-lg mx-auto">
      <h2 className="text-xl font-bold">Participación desde el móvil</h2>
      <p className="text-sm text-textSub">
        Esta es la pantalla del evento. Los participantes se registran y juegan desde su móvil.
      </p>
      <div className="w-full space-y-3">
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl py-3 px-4 font-semibold bg-[rgba(34,211,238,0.2)] border border-[rgba(34,211,238,0.35)]"
        >
          Abrir enlace participante
        </a>
        <button
          type="button"
          onClick={() => void copy()}
          className="block w-full rounded-xl py-2 text-sm border border-white/15"
        >
          Copiar enlace participante
        </button>
        {copyStatus === 'copied' && <p role="status" className="text-sm text-textSub">Enlace copiado.</p>}
        {copyStatus === 'error' && <p role="alert" className="text-sm text-red-300">No se pudo copiar el enlace. Puedes copiarlo desde el botón de participante.</p>}
      </div>
      <p className="text-xs text-textSub">
        Partida: {gameName} · {gameId}
      </p>
    </div>
  )
}
