import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/glow.css'
import { inputManager } from './core/input/inputManager'
import { mountRotatedDisplayIfEnabled } from './core/display/rotatedDisplay'

const rootElement = document.getElementById('root')!

if (!mountRotatedDisplayIfEnabled(rootElement)) {
  const pointerEnv = import.meta.env.VITE_ENABLE_POINTER_INPUT as string | undefined
  /** Clic global (p. ej. mando LG / táctil) para juegos; desactivar con VITE_ENABLE_POINTER_INPUT=false */
  const enablePointerEvents = pointerEnv !== 'false'

  inputManager.start({
    disableBackHistoryAPI: import.meta.env.VITE_WEBOS_DISABLE_BACK_HISTORY_API === 'true',
    enablePointerEvents,
  })

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
