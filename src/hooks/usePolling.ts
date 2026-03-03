import { useEffect, useRef, useState } from 'react'

interface UsePollingOptions {
  /** Base poll interval in ms. 0 = disabled. */
  interval: number
  /** Backoff cap in ms (default 60 000). */
  maxInterval?: number
  /** ms after last success before `isStale` becomes true (default 3 × interval). */
  stalenessMs?: number
}

/**
 * Polls `fn` on the given interval with exponential backoff on errors.
 *
 * - On success: reset failure count, clear staleness.
 * - On failure: double the interval (capped at maxInterval). Set `isStale`
 *   once the last successful call is older than `stalenessMs`.
 *
 * `fn` must throw (or return a rejected Promise) to signal a failure.
 *
 * @returns `{ isStale }` — true when consecutive errors have pushed the data
 *   past the staleness threshold.
 */
export function usePolling(
  fn: () => Promise<void>,
  deps: readonly unknown[],
  { interval, maxInterval = 60_000, stalenessMs }: UsePollingOptions
): { isStale: boolean } {
  const [isStale, setIsStale] = useState(false)

  // Always call the latest version of fn without re-running the effect
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (interval <= 0) return

    let cancelled = false
    let failures = 0
    let lastOk = Date.now()
    let timerId: ReturnType<typeof setTimeout>

    setIsStale(false)

    const run = async () => {
      if (cancelled) return

      try {
        await fnRef.current()
        if (!cancelled) {
          failures = 0
          lastOk = Date.now()
          setIsStale(false)
        }
      } catch {
        if (!cancelled) {
          failures += 1
          const thresh = stalenessMs ?? interval * 3
          if (Date.now() - lastOk > thresh) setIsStale(true)
        }
      }

      if (!cancelled) {
        const delay = failures === 0
          ? interval
          : Math.min(interval * 2 ** failures, maxInterval)
        timerId = setTimeout(run, delay)
      }
    }

    run()

    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, interval])

  return { isStale }
}
