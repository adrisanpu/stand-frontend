import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initialHomeCanvas } from '../home/canvasModel'
import GameHomePreview from './GameHomePreview'

const disconnect = vi.fn()
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('renders the shared canvas with sample data and local QR without actions or requests', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { unmount } = render(<GameHomePreview gameId="ABC123" gameName="Summer party" gameType="T1MER"
    appearance={null} homeCanvas={initialHomeCanvas(true, true)} />)
  expect(screen.getByLabelText('Lienzo del Home')).toBeInTheDocument()
  expect(screen.getByText('24')).toBeInTheDocument()
  expect(screen.getByText('1. Alex')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Escanea para unirte al juego' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  unmount()
  expect(disconnect).toHaveBeenCalled()
})
it('updates draft branding locally without changing document theme or using the form banner as home background', () => {
  const rootStyle = document.documentElement.getAttribute('style')
  const rootClass = document.documentElement.className
  const config = initialHomeCanvas(false, false)
  const { rerender } = render(<GameHomePreview gameId="ABC123" gameName="Event" gameType="T1MER"
    appearance={null} homeCanvas={config} logoUrl="/old-logo.png" />)
  rerender(<GameHomePreview gameId="ABC123" gameName="Event" gameType="T1MER" homeCanvas={config}
    appearance={{ themeMode: 'light', colors: { primary: '#123456', accent: '#654321' } }}
    logoUrl="/new-logo.png" bannerUrl="/banner.png" />)
  expect(screen.getByRole('tabpanel', { name: 'Home' }).firstElementChild).toHaveStyle('--color-primary: #123456; --color-accent: #654321; --color-background: #F5F5F7')
  expect(screen.getByRole('img', { name: 'Logo del evento' })).toHaveAttribute('src', '/new-logo.png')
  expect(document.querySelector('img[src="/banner.png"]')).toBeNull()
  expect(document.documentElement.getAttribute('style')).toBe(rootStyle)
  expect(document.documentElement.className).toBe(rootClass)
})
it('uses the selected portrait draft and does not populate an intentionally empty canvas', () => {
  const config = initialHomeCanvas(true, true)
  config.portrait.items = []
  render(<GameHomePreview gameId="ABC123" gameName="Event" gameType="T1MER" appearance={null}
    homeCanvas={config} orientation="portrait" />)
  expect(screen.queryByText('24')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Lienzo del Home').querySelector('[data-home-stage]')).toHaveStyle('width: 1080px; height: 1920px')
})
it.each([
  ['T1MER', '00:00.0'], ['STACK', 'Bloques:'], ['RULET4', 'RULET4'],
  ['EMPAREJA2', 'Tu misión: encuentra a Luna'], ['IMPOSTOR', 'Tu palabra'],
])('shows a safe mobile representation for %s without sessions or actions', (gameType, text) => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const session = localStorage.getItem('playerToken')
  render(<GameHomePreview gameId="ABC123" gameName="Event" gameType={gameType}
    appearance={{ themeMode: 'light', colors: { primary: '#123456', accent: '#654321' } }}
    logoUrl="/logo.png" bannerUrl="/banner.png" />)
  fireEvent.click(screen.getByRole('tab', { name: 'Juego (/play)' }))
  const panel = screen.getByRole('tabpanel', { name: 'Juego (/play)' })
  expect(panel).toHaveTextContent(text)
  expect(screen.getByRole('img', { name: 'Logo del evento' })).toHaveAttribute('src', '/logo.png')
  expect(panel.querySelector('img[alt=""]')).toHaveAttribute('src', '/banner.png')
  screen.queryAllByRole('button').forEach(button => expect(button).toBeDisabled())
  expect(panel.querySelector('canvas,iframe')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  expect(localStorage.getItem('playerToken')).toBe(session)
})
