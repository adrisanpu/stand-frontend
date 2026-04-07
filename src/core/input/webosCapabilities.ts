import type { BackMode, TouchMode } from './types'

type WebOSWindow = Window & {
  webOSSystem?: {
    platformBack?: () => void
  }
}

export type WebOSCapabilities = {
  isWebOS: boolean
  touchMode: TouchMode
  backMode: BackMode
  hasPointer: boolean
  hasKeyboard: boolean
  platformBack?: () => void
}

function readTouchMode(): TouchMode {
  const modeFromGlobal = (window as Window & { __WEBOS_TOUCH_MODE__?: string }).__WEBOS_TOUCH_MODE__
  if (modeFromGlobal === 'full' || modeFromGlobal === 'virtual') {
    return modeFromGlobal
  }
  return 'none'
}

export function detectWebOSCapabilities(disableBackHistoryAPI: boolean, supportTouchMode?: TouchMode): WebOSCapabilities {
  const navigatorUA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const isWebOS = /web0s|webos|smarttv/i.test(navigatorUA)
  const touchMode = supportTouchMode && supportTouchMode !== 'none' ? supportTouchMode : readTouchMode()
  const backMode: BackMode = disableBackHistoryAPI ? 'manual' : 'history'
  const hasPointer = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer:fine)').matches : true
  const hasKeyboard = true
  const platformBack = (window as WebOSWindow).webOSSystem?.platformBack

  return {
    isWebOS,
    touchMode,
    backMode,
    hasPointer,
    hasKeyboard,
    platformBack,
  }
}

