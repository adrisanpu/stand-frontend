import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const ConfigurationActionsContext = createContext<{
  target: HTMLElement | null
  active: boolean
  disabled: boolean
} | null>(null)

export default function ConfigurationActions({ children, visible = true }: { children: ReactNode; visible?: boolean }) {
  const context = useContext(ConfigurationActionsContext)
  if (!visible) return null
  if (!context) return <>{children}</>
  if (!context.active || !context.target) return null
  return createPortal(
    <fieldset disabled={context.disabled} className="flex min-w-0 items-center gap-2">{children}</fieldset>,
    context.target,
  )
}
