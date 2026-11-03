import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrientation } from './useOrientation'

function resize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/home')
  resize(1440, 900)
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  document.documentElement.classList.remove('force-portrait', 'force-landscape')
})

describe('event orientation', () => {
  it('preserves the portrait default for other games on wide screens', () => {
    const { result } = renderHook(() => useOrientation())
    expect(result.current).toBe(true)
  })

  it.each([
    [320, 568, true], [390, 844, true], [844, 390, true],
    [768, 1024, true], [1024, 768, false], [1024, 599, true],
    [1024, 600, false], [1280, 720, false], [1920, 1080, false],
    [1080, 1920, true],
  ])('adapts automatic layouts at %sx%s (portrait=%s)', (width, height, portrait) => {
    resize(width, height)
    const { result } = renderHook(() => useOrientation(true))
    expect(result.current).toBe(portrait)
    expect(localStorage.getItem('stand.forcePortrait')).toBeNull()
  })

  it('reacts to resizing without needing a physical orientation change', () => {
    const { result } = renderHook(() => useOrientation(true))
    expect(result.current).toBe(false)
    act(() => resize(900, 700))
    expect(result.current).toBe(true)
    act(() => resize(1200, 700))
    expect(result.current).toBe(false)
  })

  it('updates when the loaded game opts into automatic layout', () => {
    const { result, rerender } = renderHook(({ automatic }) => useOrientation(automatic), {
      initialProps: { automatic: false },
    })
    expect(result.current).toBe(true)
    rerender({ automatic: true })
    expect(result.current).toBe(false)
  })

  it.each([
    ['?portrait=1', true], ['?portrait=0', false],
    ['?forcePortrait=true', true], ['?forcePortrait=off', false],
  ])('honors and persists explicit URL preference %s', (query, portrait) => {
    localStorage.setItem('stand.forcePortrait', portrait ? '0' : '1')
    window.history.replaceState({}, '', `/home${query}`)
    const { result } = renderHook(() => useOrientation(true))
    expect(result.current).toBe(portrait)
    expect(localStorage.getItem('stand.forcePortrait')).toBe(portrait ? '1' : '0')
    act(() => resize(390, 844))
    expect(result.current).toBe(portrait)
  })

  it.each([true, false])('honors saved portrait=%s and storage changes', (portrait) => {
    localStorage.setItem('stand.forcePortrait', portrait ? '1' : '0')
    const { result } = renderHook(() => useOrientation(true))
    expect(result.current).toBe(portrait)
    act(() => {
      localStorage.setItem('stand.forcePortrait', portrait ? '0' : '1')
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current).toBe(!portrait)
  })
})
