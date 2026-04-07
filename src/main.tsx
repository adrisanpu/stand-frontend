import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/glow.css'
import { inputManager } from './core/input/inputManager'
import type { TouchMode } from './core/input/types'

const envTouchMode = (import.meta.env.VITE_WEBOS_TOUCH_MODE as string | undefined) || 'none'
const supportTouchMode: TouchMode =
  envTouchMode === 'full' || envTouchMode === 'virtual' ? envTouchMode : 'none'

inputManager.start({
  preferExistingInputs: true,
  supportTouchMode,
  disableBackHistoryAPI: import.meta.env.VITE_WEBOS_DISABLE_BACK_HISTORY_API === 'true',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
