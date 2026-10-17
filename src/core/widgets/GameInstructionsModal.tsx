import { useEffect, type ReactNode } from 'react'
import { GAME_DATA_NOTICE_MODAL, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type GameInstructionsModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function GameInstructionsModal({ open, onClose, children }: GameInstructionsModalProps) {
  const { language, t } = useOperatorLanguage()
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-instructions-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-md p-5 sm:p-6 max-h-[90vh] flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 id="game-instructions-title" className="text-lg font-semibold text-textMain">
            {t('Instrucciones', 'Instructions')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={t('Cerrar', 'Close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <ul className="m-0 list-none space-y-2.5 sm:space-y-3 p-0 text-sm text-gray-300">{children}</ul>
        </div>

        <footer className="flex-shrink-0 mt-4 pt-4 border-t border-white/10 space-y-2">
          <p className="text-[11px] sm:text-xs leading-snug text-gray-400">
            {t(
              GAME_DATA_NOTICE_MODAL,
              'By scanning the QR code and participating, you agree that Stand (the service provider) and the event organizer may process your personal data—including your Instagram username, participation data, and quiz answers, if any—to manage the game experience, scores, and raffles. You may exercise your rights of access, rectification, and erasure as described in the privacy policy.'
            )}
          </p>
          <a
            href={language === 'en' ? '/pages/privacy.html' : PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[11px] sm:text-xs text-gray-400 underline underline-offset-2 hover:text-gray-300"
          >
            {t('Política de privacidad', 'Privacy policy')}
          </a>
        </footer>
      </div>
    </div>
  )
}
