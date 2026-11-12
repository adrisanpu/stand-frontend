import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HomeCanvas from './HomeCanvas'
import { initialHomeCanvas } from './canvasModel'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  sessionStorage.clear()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('keeps QR locally generated, square and opaque against arbitrary backgrounds', () => {
  const config = initialHomeCanvas(false, false)
  render(<HomeCanvas gameId="EVENT" gameName="Event" composition={config.landscape} orientation="landscape" />)
  const qr = screen.getByRole('img', { name: 'Escanea para unirte al juego' })
  expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  expect(qr).toHaveAttribute('data-qr-value', `${window.location.origin}/play/EVENT`)
  expect(qr.parentElement).toHaveClass('!bg-black')
  expect(qr.closest('.card')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Escanea para jugar' })).not.toBeInTheDocument()
})
it('does not repopulate empty canvases and escapes text content', () => {
  const { rerender } = render(<HomeCanvas gameId="EVENT" gameName="Event" composition={{ background: null, items: [] }} orientation="portrait" />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="portrait" composition={{ background: null,
    items: [{ id: 'text', type: 'text', x: 0, y: 0, w: 6, h: 2, text: '<img src=x onerror=alert(1)>' }] }} />)
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})
it('adapts text scale to both panel dimensions', () => {
  const item = { id: 'text', type: 'text' as const, x: 0, y: 0, w: 6, h: 2, text: 'Adaptive' }
  const { rerender } = render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape"
    composition={{ background: null, items: [item] }} />)
  const widget = () => document.querySelector<HTMLElement>('.home-canvas-widget')!
  expect(widget().style.getPropertyValue('--home-text-scale')).toBe('1')
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape"
    composition={{ background: null, items: [{ ...item, w: 12, h: 4 }] }} />)
  expect(Number(widget().style.getPropertyValue('--home-text-scale'))).toBeGreaterThan(2)
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape"
    composition={{ background: null, items: [{ ...item, w: 12, h: 1 }] }} />)
  expect(widget().style.getPropertyValue('--home-text-scale')).toBe('0.4')
})
it('falls back to muted autoplay and offers sound activation outside the editable stage', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
    .mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'))
    .mockResolvedValue(undefined)
  render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" fit backgroundUrl="/background.mp4"
    composition={{ background: { key: 'background', type: 'video' }, items: [] }} />)
  const button = await screen.findByRole('button', { name: 'Activar sonido' })
  expect(button.closest('[data-home-stage]')).toBeNull()
  expect(document.querySelector('video')?.muted).toBe(true)
  fireEvent.click(button)
  await screen.findByRole('button', { name: 'Silenciar fondo' })
  expect(document.querySelector('video')?.muted).toBe(false)
  expect(play).toHaveBeenCalledTimes(3)
  expect(sessionStorage.getItem('stand.home.sound')).toBe('on')
})
it('surfaces actual playback errors rather than treating them as autoplay policy', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('Unsupported codec', 'NotSupportedError'))
  render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" backgroundUrl="/invalid.mp4"
    composition={{ background: { key: 'invalid', type: 'video' }, items: [] }} />)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se puede reproducir'))
})
it('keeps preview video muted regardless of saved audio preference', async () => {
  sessionStorage.setItem('stand.home.sound', 'on')
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="portrait" preview backgroundUrl="/background.mp4"
    composition={{ background: { key: 'background', type: 'video' }, items: [] }} />)
  await waitFor(() => expect(play).toHaveBeenCalledOnce())
  expect(document.querySelector('video')?.muted).toBe(true)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
