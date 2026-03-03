import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePolling } from './usePolling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fn immediately on mount', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, [], { interval: 1000 }))
    await act(async () => { await Promise.resolve() })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls fn again after the interval', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, [], { interval: 1000 }))
    await act(async () => { await Promise.resolve() })
    expect(fn).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not poll when interval is 0', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, [], { interval: 0 }))
    await act(async () => { await Promise.resolve() })
    expect(fn).not.toHaveBeenCalled()
  })

  it('isStale starts as false', () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePolling(fn, [], { interval: 1000 }))
    expect(result.current.isStale).toBe(false)
  })

  it('applies exponential backoff on failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    renderHook(() => usePolling(fn, [], { interval: 1000 }))

    // First call (immediate)
    await act(async () => { await Promise.resolve() })
    expect(fn).toHaveBeenCalledTimes(1)

    // After 1st failure: backoff = min(1000 * 2^1, 60000) = 2000 ms
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(fn).toHaveBeenCalledTimes(2)

    // After 2nd failure: backoff = min(1000 * 2^2, 60000) = 4000 ms
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
    })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('sets isStale after failures exceed staleness threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    // stalenessMs=1 so any delay exceeds the threshold
    const { result } = renderHook(() =>
      usePolling(fn, [], { interval: 1000, stalenessMs: 1 })
    )

    // Initial call
    await act(async () => { await Promise.resolve() })

    // Advance past backoff + staleness window
    await act(async () => {
      vi.advanceTimersByTime(2001)
      await Promise.resolve()
    })

    expect(result.current.isStale).toBe(true)
  })

  it('resets isStale on successful call after failures', async () => {
    let callCount = 0
    const fn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount <= 2) return Promise.reject(new Error('fail'))
      return Promise.resolve()
    })

    const { result } = renderHook(() =>
      usePolling(fn, [], { interval: 1000, stalenessMs: 1 })
    )

    // 1st call fails
    await act(async () => { await Promise.resolve() })

    // 2nd call fails (after backoff of 2000ms), staleness kicks in
    await act(async () => {
      vi.advanceTimersByTime(2001)
      await Promise.resolve()
    })
    expect(result.current.isStale).toBe(true)

    // 3rd call succeeds (after backoff of 4000ms)
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
    })
    expect(result.current.isStale).toBe(false)
  })

  it('stops polling after unmount', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => usePolling(fn, [], { interval: 500 }))
    await act(async () => { await Promise.resolve() })
    const callsAfterMount = fn.mock.calls.length

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(fn.mock.calls.length).toBe(callsAfterMount)
  })
})
