import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'
import T1merParticipantPlay from './ParticipantPlay'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  sessionStorage.clear()
})

it('displays and hides the timer without changing the recorded time', async () => {
  vi.useFakeTimers()
  const score = vi.spyOn(publicApi, 'score').mockResolvedValue({ ok: true, rank: 2 })
  const onFinished = vi.fn()
  render(<T1merParticipantPlay gameId="GAME1" playerToken="token" onFinished={onFinished} />)

  expect(screen.getByRole('timer')).toHaveTextContent('00:00.0')
  expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off')
  expect(screen.getByRole('timer')).not.toHaveClass('t1mer-clock__digits--counting')
  fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
  act(() => vi.advanceTimersByTime(4990))
  expect(screen.getByRole('timer')).not.toHaveTextContent('??:??.?')
  act(() => vi.advanceTimersByTime(10))
  expect(screen.getByRole('timer')).toHaveTextContent('??:??.?')
  expect(screen.getByRole('timer')).toHaveClass('t1mer-clock__digits--counting')
  act(() => vi.advanceTimersByTime(5000))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'DETENER' })))

  expect(score).toHaveBeenCalledWith({ gameId: 'GAME1', playerToken: 'token', timer: '10.000', score: 0 })
  expect(onFinished).toHaveBeenCalledWith({ time: 10, difference: 0, rank: 2 })
  expect(screen.getByRole('timer')).toHaveTextContent('??:??.?')
  expect(screen.getByRole('timer')).not.toHaveClass('t1mer-clock__digits--counting')
})
