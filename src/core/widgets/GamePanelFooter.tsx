import { useState, type ReactNode } from 'react'
import { GAME_DATA_NOTICE_PANEL, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import GameInstructionsModal from './GameInstructionsModal'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type GamePanelFooterProps = {
  children: ReactNode
}

export function GamePanelFooter({ children }: GamePanelFooterProps) {
  const { language, t } = useOperatorLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 w-full min-w-0 pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('Ver instrucciones', 'View instructions')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-gray-300/90 hover:bg-white/5 hover:border-white/30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </button>
        <p className="text-[9px] sm:text-[10px] leading-snug text-center text-gray-400/80 max-w-full px-1">
          {t(
            GAME_DATA_NOTICE_PANEL,
            'By participating, you agree to the processing of your registration and participation data, including quiz answers if applicable.'
          )}{' '}
          <a
            href={language === 'en' ? '/pages/privacy.html' : PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gray-300/90"
          >
            {t('Política de privacidad', 'Privacy policy')}
          </a>
        </p>
      </div>
      <GameInstructionsModal open={open} onClose={() => setOpen(false)}>
        {children}
      </GameInstructionsModal>
    </>
  )
}
