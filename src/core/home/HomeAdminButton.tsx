type HomeAdminButtonProps = {
  label: string
  onClick: () => void
}

export default function HomeAdminButton({ label, onClick }: HomeAdminButtonProps) {
  return <button type="button" onClick={onClick} aria-label={label} title={label}
    className="stage-control group fixed bottom-3 right-3 z-30 flex h-14 w-14 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
    <img src="/images/logo-stand-footer.png" alt="" className="h-full w-full object-contain" />
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className="pointer-events-none absolute h-4 w-4 text-black opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  </button>
}
