import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import jsQR from 'jsqr'
import { publicApi } from '../../api/publicApi'
import ValidatorShell from './ValidatorShell'

vi.mock('jsqr', () => ({ default: vi.fn() }))
vi.mock('../../api/publicApi', () => ({ publicApi: { redeem: vi.fn() } }))

const stop = vi.fn()

beforeEach(() => {
  vi.mocked(jsQR).mockReset()
  vi.mocked(publicApi.redeem).mockReset()
  stop.mockClear()
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(2)
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1)
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }),
  }))
  vi.mocked(jsQR).mockReturnValue({ data: 'prize-token' } as ReturnType<typeof jsQR>)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderValidator() {
  return render(
    <MemoryRouter initialEntries={['/validator/ABC123']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/validator/:gameId" element={<ValidatorShell />} /></Routes>
    </MemoryRouter>,
  )
}

it('shows the redeemed prize image and name above the delivery confirmation and clears them on rescan', async () => {
  vi.mocked(publicApi.redeem).mockResolvedValue({
    ok: true, gameId: 'ABC123', playerId: 1, kind: 'ranking', delivered: true, label: 'adri',
    prize: { name: 'Consola', limit: 3, imageUrl: '/console.png' },
  })
  renderValidator()
  const message = await screen.findByText('Premio del ranking entregado a adri.')
  const image = screen.getByRole('img', { name: 'Consola' })
  expect(image).toHaveAttribute('src', '/console.png')
  expect(screen.getByText('Consola').parentElement?.nextElementSibling).toBe(message)
  expect(publicApi.redeem).toHaveBeenCalledWith('prize-token')
  expect(stop).toHaveBeenCalled()

  vi.mocked(jsQR).mockReturnValue(null)
  fireEvent.click(screen.getByRole('button', { name: 'Escanear otro' }))
  await waitFor(() => expect(screen.queryByText('Consola')).not.toBeInTheDocument())
  expect(screen.queryByRole('img', { name: 'Consola' })).not.toBeInTheDocument()
})

it('keeps legacy delivery confirmations working without catalog details', async () => {
  vi.mocked(publicApi.redeem).mockResolvedValue({
    ok: true, gameId: 'ABC123', playerId: 1, kind: 'validation', delivered: true, label: 'adri',
  })
  renderValidator()
  expect(await screen.findByText('Premio por pareja entregado a adri.')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('does not show a prize when redemption fails', async () => {
  vi.mocked(publicApi.redeem).mockRejectedValue(Object.assign(new Error('AlreadyDelivered'), { status: 409 }))
  renderValidator()
  expect(await screen.findByText('Este premio ya se había entregado.')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
