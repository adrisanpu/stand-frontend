import { useState } from 'react'
import { getWebPlayUrl } from '../lib/joinUrl'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type Props = {
  gameId: string
  gameName: string
}

export default function MobileParticipantsPanel({ gameId, gameName }: Props) {
  const { t } = useOperatorLanguage()
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
      <h2 className="text-xl font-bold">{t('Participación desde el móvil', 'Mobile participation')}</h2>
      <p className="text-sm text-textSub">
        {t('Esta es la pantalla del evento. Los participantes se registran y juegan desde su móvil.', 'This is the event screen. Participants register and play on their phones.')}
      </p>
      <div className="w-full space-y-3">
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl py-3 px-4 font-semibold bg-[rgba(34,211,238,0.2)] border border-[rgba(34,211,238,0.35)]"
        >
          {t('Abrir enlace participante', 'Open participant link')}
        </a>
        <button
          type="button"
          onClick={() => void copy()}
          className="block w-full rounded-xl py-2 text-sm border border-white/15"
        >
          {t('Copiar enlace participante', 'Copy participant link')}
        </button>
        {copyStatus === 'copied' && <p role="status" className="text-sm text-textSub">{t('Enlace copiado.', 'Link copied.')}</p>}
        {copyStatus === 'error' && <p role="alert" className="text-sm text-red-300">{t('No se pudo copiar el enlace. Puedes copiarlo desde el botón de participante.', 'Could not copy the link. You can copy it from the participant button.')}</p>}
      </div>
      <p className="text-xs text-textSub">
        {t('Partida', 'Game')}: {gameName} · {gameId}
      </p>
    </div>
  )
}
