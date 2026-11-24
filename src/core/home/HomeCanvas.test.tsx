import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HomeCanvas from './HomeCanvas'
import { initialHomeCanvas } from './canvasModel'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  sessionStorage.clear()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('keeps QR locally generated with a square black backing and no border', () => {
  const config = initialHomeCanvas(false, false)
  render(<HomeCanvas gameId="EVENT" gameName="Event" composition={config.landscape} orientation="landscape" />)
  const qr = screen.getByRole('img', { name: 'Escanea para unirte al juego' })
  expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  expect(qr).toHaveAttribute('data-qr-value', `${window.location.origin}/play/EVENT`)
  expect(qr.parentElement).toHaveClass('!bg-black', '!border-0', '!p-0')
  expect(qr.parentElement?.parentElement?.parentElement).toHaveStyle({ aspectRatio: '1 / 1' })
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
it('scopes canvas colors and proportional size while honoring widget overrides and alignment', () => {
  const item = { id: 'text', type: 'text' as const, x: 0, y: 0, w: 6, h: 2, text: 'Styled' }
  const composition = { background: null, items: [item], backgroundColor: '#123456', accentColor: '#abcdef', color: '#ffffff', fontSize: 96 }
  const { rerender } = render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={composition} />)
  const stage = document.querySelector<HTMLElement>('[data-home-stage]')!
  const widget = () => document.querySelector<HTMLElement>('.home-canvas-widget')!
  expect(stage).toHaveStyle({ backgroundColor: '#123456' })
  expect(stage.style.getPropertyValue('--color-primary')).toBe('#abcdef')
  expect(stage.style.getPropertyValue('--color-accent')).toBe('#abcdef')
  expect(stage.style.getPropertyValue('--color-primary-rgb')).toBe('171,205,239')
  expect(stage.style.getPropertyValue('--color-text-main')).toBe('#ffffff')
  expect(stage.style.getPropertyValue('--color-text-sub')).toBe('#ffffff')
  expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('')
  expect(widget().style.getPropertyValue('--home-text-scale')).toBe('2')
  expect(document.querySelector('.home-canvas-text')).toHaveStyle({ textAlign: 'center' })
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{
    ...composition, items: [{ ...item, fontSize: 24, accentColor: '#ff0000', color: '#000000', align: 'left', backgroundColor: 'transparent' }],
  }} />)
  expect(widget().style.getPropertyValue('--home-text-scale')).toBe('0.5')
  expect(widget().style.getPropertyValue('--color-primary')).toBe('#ff0000')
  expect(widget().style.getPropertyValue('--color-text-main')).toBe('#000000')
  expect(widget().style.backgroundColor).toBe('transparent')
  expect(document.querySelector('.home-canvas-text')).toHaveStyle({ textAlign: 'left' })
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{ background: null, items: [item] }} />)
  expect(stage.style.getPropertyValue('--color-primary')).toBe('')
  expect(widget().style.getPropertyValue('--color-primary')).toBe('')
  expect(widget().style.getPropertyValue('--home-text-scale')).toBe('1')
})
it('uses the centered players container in live and sample widgets without changing the QR contrast', () => {
  const composition = initialHomeCanvas(false, false).landscape
  render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{
    ...composition, accentColor: '#ff0000', color: '#111111', backgroundColor: '#eeeeee',
  }} players={<div className="flex flex-col"><div className="card">24 Players</div></div>} />)
  expect(screen.getByText('24 Players').closest('.home-canvas-widget')).toHaveClass('home-widget-players')
  expect(screen.getByRole('img', { name: 'Escanea para unirte al juego' }).parentElement).toHaveClass('!bg-black')
})
it.each([[8, 12], [12, 8]])('fits the square black QR inside a %s by %s panel without filling its extra space', (w, h) => {
  render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{
    background: null, items: [{ id: 'qr', type: 'qr', x: 0, y: 0, w, h, backgroundColor: '#ff0000' }],
  }} />)
  const qr = screen.getByRole('img', { name: 'Escanea para unirte al juego' })
  const square = qr.parentElement?.parentElement?.parentElement
  expect(square).toHaveStyle({ width: `${Math.min(w, h) * 60 - 20}px`, aspectRatio: '1 / 1' })
  expect(qr.closest<HTMLElement>('.home-canvas-widget')?.style.backgroundColor).toBe('transparent')
})
it('inherits bold from the canvas and supports false overrides without changing legacy weights', () => {
  const item = { id: 'text', type: 'text' as const, x: 0, y: 0, w: 6, h: 2, text: 'Bold' }
  const composition = { background: null, items: [item], bold: true }
  const { rerender } = render(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={composition} />)
  const widget = () => document.querySelector<HTMLElement>('.home-canvas-widget')!
  expect(document.querySelector<HTMLElement>('[data-home-stage]')!.style.getPropertyValue('--home-font-weight')).toBe('700')
  expect(widget()).toHaveClass('home-widget-font-weight')
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{ ...composition, items: [{ ...item, bold: false }] }} />)
  expect(widget().style.getPropertyValue('--home-font-weight')).toBe('400')
  rerender(<HomeCanvas gameId="EVENT" gameName="Event" orientation="landscape" composition={{ background: null, items: [item] }} />)
  expect(widget()).not.toHaveClass('home-widget-font-weight')
  expect(widget().style.getPropertyValue('--home-font-weight')).toBe('')
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
