import type { ButtonHTMLAttributes } from 'react'

export default function SaveButton({ children, className = '', iconOnly = false, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { children: string; iconOnly?: boolean }) {
  return <button type="button" {...props} aria-label={iconOnly ? children : props['aria-label']}
    title={iconOnly ? children : props.title}
    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/20 p-3 text-sm font-medium text-textMain transition-colors hover:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>
    {iconOnly ? <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8" />
    </svg> : children}
  </button>
}
