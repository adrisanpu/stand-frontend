import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/glow.css'
import { inputManager } from './core/input/inputManager'

const isWebOS = typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
const pointerEnv = import.meta.env.VITE_ENABLE_POINTER_INPUT as string | undefined
const enablePointerEvents =
  pointerEnv === 'true' || (pointerEnv !== 'false' && !isWebOS)

inputManager.start({
  disableBackHistoryAPI: import.meta.env.VITE_WEBOS_DISABLE_BACK_HISTORY_API === 'true',
  enablePointerEvents,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
