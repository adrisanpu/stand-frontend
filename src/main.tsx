import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/glow.css'
import { inputManager } from './core/input/inputManager'
import { startWebOSPointerFocusSync } from './core/input/webosPointerFocusSync'
import type { TouchMode } from './core/input/types'

const envTouchMode = (import.meta.env.VITE_WEBOS_TOUCH_MODE as string | undefined) || 'none'
const supportTouchMode: TouchMode =
  envTouchMode === 'full' || envTouchMode === 'virtual' ? envTouchMode : 'none'

const isWebOS = typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
/** En webOS, por defecto false: el inputManager no escucha click. true = emite click al bus (p. ej. futuros mapeos). */
const pointerEnv = import.meta.env.VITE_ENABLE_POINTER_INPUT as string | undefined
const enablePointerEvents =
  pointerEnv === 'true' || (pointerEnv !== 'false' && !isWebOS)

inputManager.start({
  preferExistingInputs: true,
  supportTouchMode,
  disableBackHistoryAPI: import.meta.env.VITE_WEBOS_DISABLE_BACK_HISTORY_API === 'true',
  enablePointerEvents,
})

startWebOSPointerFocusSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
