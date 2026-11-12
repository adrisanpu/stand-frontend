import type { ButtonHTMLAttributes } from 'react'

export const adminIconPaths = {
  create: 'M12 5v14M5 12h14',
  open: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
  activate: 'm8 5 11 7-11 7Z',
  deactivate: 'M7 5h3v14H7zM14 5h3v14h-3z',
  closing: 'M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4',
  archive: 'M4 8h16v13H4zM3 3h18v5H3zM9 12h6',
  restore: 'M4 10v11h16V10M3 3h18v5H3zM12 17V10m-3 3 3-3 3 3',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  reload: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M18 18a8 8 0 0 1-14-6',
  confirm: 'm5 12 4 4L19 6',
  cancel: 'm6 6 12 12M6 18 18 6',
  configure: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  more: 'm6 9 6 6 6-6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
}

export type AdminIconName = keyof typeof adminIconPaths

export function AdminIcon({ name, className = 'h-6 w-6' }: { name: AdminIconName; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={adminIconPaths[name]} />
  </svg>
}

export function AdminIconButton({ icon, label, tone = 'default', small = false, className = '', ...props }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    icon: AdminIconName; label: string; tone?: 'default' | 'primary' | 'danger'; small?: boolean
  }) {
  const toneClass = tone === 'danger' ? 'border-red-400/40' : tone === 'primary' ? 'border-current/20 bg-primary/20' : 'border-current/20'
  return <button type="button" {...props} aria-label={label} title={label}
    className={`inline-flex shrink-0 items-center justify-center rounded-xl border ${small ? 'p-2' : 'p-3'} ${toneClass} disabled:opacity-50 ${className}`}>
    <AdminIcon name={icon} className={small ? 'h-5 w-5' : 'h-6 w-6'} />
  </button>
}
