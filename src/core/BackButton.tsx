type BackButtonProps = {
  onClick: () => void
  'aria-label'?: string
  className?: string
}

/** Circular arrow (arrow path) icon button for "go back" / reset in portrait expanded view */
export default function BackButton({ onClick, 'aria-label': ariaLabel = 'Volver', className = '' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`p-2.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-black/30 transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] ${className}`}
    >
      <svg className="w-6 h-6 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  )
}
