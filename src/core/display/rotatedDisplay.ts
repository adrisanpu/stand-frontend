/**
 * Rotated display mode: for a physically rotated (vertical) monitor fed by a landscape
 * signal (e.g. iPad over HDMI at 1920x1080). The app is rendered inside an iframe whose
 * viewport is portrait (1080x1920), then rotated 90° so it fills the landscape output.
 * Inside the iframe vh/vw and `(orientation: portrait)` behave like a real vertical screen.
 *
 * Enable: ?rotate=right (clockwise) | ?rotate=left (counter-clockwise). Disable: ?rotate=off.
 * The choice is persisted in localStorage.
 */
export type DisplayRotation = 'right' | 'left'

const STORAGE_KEY = 'stand.displayRotation'
const PARAM = 'rotate'

function readRotation(url: URL): DisplayRotation | null {
  const param = url.searchParams.get(PARAM)?.toLowerCase()
  if (param === 'off' || param === 'none' || param === '0') {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
  if (param === 'right' || param === '90') {
    localStorage.setItem(STORAGE_KEY, 'right')
    return 'right'
  }
  if (param === 'left' || param === '-90' || param === '270') {
    localStorage.setItem(STORAGE_KEY, 'left')
    return 'left'
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'right' || stored === 'left' ? stored : null
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/** Returns true when the rotated frame was mounted (the caller must not render the app). */
export function mountRotatedDisplayIfEnabled(root: HTMLElement): boolean {
  if (isEmbedded()) return false
  const url = new URL(window.location.href)
  const rotation = readRotation(url)
  if (!rotation) return false

  url.searchParams.delete(PARAM)
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.body.style.margin = '0'

  const frame = document.createElement('iframe')
  frame.src = url.pathname + url.search + url.hash
  frame.title = 'Stand'
  frame.allow = 'camera; microphone; fullscreen; clipboard-write'
  Object.assign(frame.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vh',
    height: '100vw',
    border: '0',
    transformOrigin: 'top left',
    transform: rotation === 'right' ? 'rotate(90deg) translateY(-100%)' : 'rotate(-90deg) translateX(-100%)',
  })

  root.replaceChildren(frame)
  return true
}
