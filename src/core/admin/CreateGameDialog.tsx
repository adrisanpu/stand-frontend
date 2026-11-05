import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { operatorGameHomeUrl } from '../../api/operatorGames'
import GameGate from '../shell/GameGate'
import { useOperatorLanguage } from '../shell/operatorLanguage'

export default function CreateGameDialog({ onClose }: { onClose: () => void }) {
  const { language, t } = useOperatorLanguage()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialog} lang={language} role="dialog" aria-modal="true" aria-labelledby="create-game-title" tabIndex={-1}
        className="w-full max-w-5xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-current/20 bg-[var(--color-background)] p-4 text-textMain shadow-xl sm:p-6"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
          if (event.key !== 'Tab') return
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) ?? []).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
            event.preventDefault()
            first?.focus()
          }
        }}>
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 id="create-game-title" className="text-2xl font-semibold">{t('Crear partida', 'Create event')}</h2>
          <button type="button" className="rounded-xl border border-current/20 px-3 py-2" onClick={onClose}
            aria-label={t('Cerrar catálogo', 'Close catalog')}>{t('Cerrar', 'Close')}</button>
        </header>
        <GameGate showHeaderLogo={false} onGameCreated={(_name, gameId) => navigate(operatorGameHomeUrl(gameId))} />
      </div>
    </div>,
    document.body,
  )
}
