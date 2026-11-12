import type { ButtonHTMLAttributes } from 'react'

const paths = {
  add: 'M12 5v14M5 12h14',
  group: 'M4 4h7v7H4zM13 13h7v7h-7zM16.5 3v7M13 6.5h7',
  remove: 'M5 5l14 14M19 5 5 19',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  reload: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17',
}

export default function IconButton({ label, icon, className = '', ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: keyof typeof paths
}) {
  return <button type="button" {...props} aria-label={label} title={label}
    data-tone={icon === 'delete' || icon === 'remove' ? 'danger' : undefined}
    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${
      icon === 'delete' || icon === 'remove'
        ? 'border-red-500/40 bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-600'
        : 'border-primary/40 bg-primary/20 text-textSub hover:bg-primary/30 hover:text-textMain'
    } ${className}`}>
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon]} />
    </svg>
  </button>
}
