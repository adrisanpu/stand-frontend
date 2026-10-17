import { useOperatorLanguage } from '../shell/operatorLanguage'

export function GameIdHint({ gameId, joinChannel }: { gameId: string; joinChannel?: string | null }) {
  const { t } = useOperatorLanguage()
  return (
    <div className="flex items-center justify-center gap-1 min-w-0 w-full">
      <span
        className="text-[10px] sm:text-xs font-mono text-textMain opacity-50 truncate min-w-0"
        title={gameId}
      >
        {gameId}
      </span>
      <span className="group relative inline-flex flex-shrink-0">
        <button
          type="button"
          aria-label={t('Cómo unirte si el QR no funciona', 'How to join if the QR code does not work')}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-semibold text-gray-300/90"
        >
          i
        </button>
        <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/15 bg-[rgba(17,24,39,0.98)] p-2 text-left text-xs text-gray-200 shadow-lg group-hover:block sm:w-64">
          {joinChannel === 'instagram'
            ? t('Si el QR no te une, envía este código como mensaje en el mismo chat de Instagram con Stand.', 'If the QR code does not let you join, send this code as a message in the same Instagram chat with Stand.')
            : t('Si el QR no funciona, vuelve a abrir el enlace del formulario del evento o pide ayuda al organizador.', 'If the QR code does not work, reopen the event form link or ask the organizer for help.')}
        </span>
      </span>
    </div>
  )
}
