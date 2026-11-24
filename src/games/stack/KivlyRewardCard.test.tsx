import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'
import KivlyRewardCard from './KivlyRewardCard'
import { ParticipantLanguageProvider, ParticipantLanguageSelector } from '../../core/participant/participantLanguage'

vi.mock('../../api/publicApi', () => ({ publicApi: { completionReward: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

it('shows only real Wallet links for a confirmed reward', async () => {
  vi.mocked(publicApi.completionReward).mockResolvedValue({
    status: 'confirmed', name: 'Coffee', googleWalletUrl: 'https://pay.google.com/gp/v/save/test',
    appleWalletUrl: 'https://api.getkivly.com/pass/test',
  })
  render(<KivlyRewardCard gameId="ABC123" playerToken="token" />)
  expect(await screen.findByText('Coffee')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Apple Wallet' })).toHaveAttribute('href', 'https://api.getkivly.com/pass/test')
  expect(screen.getByRole('link', { name: 'Google Wallet' })).toHaveAttribute('href', 'https://pay.google.com/gp/v/save/test')
  expect(screen.getByRole('link', { name: 'Google Wallet' })).toHaveClass('rounded-xl', 'bg-white')
  expect(publicApi.completionReward).toHaveBeenCalledWith('ABC123', 'token')
})

it('keeps a confirmed reward visible without inventing pass links', async () => {
  vi.mocked(publicApi.completionReward).mockResolvedValue({ status: 'confirmed', name: 'Coffee' })
  render(<KivlyRewardCard gameId="ABC123" playerToken="token" />)
  expect(await screen.findByText('Tarjeta no disponible todavía.')).toBeInTheDocument()
  expect(screen.getByText('Premio asignado a tu cuenta del club.')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('explains pending assignment and checks its server state on request', async () => {
  vi.mocked(publicApi.completionReward).mockResolvedValue({ status: 'pending', name: 'Coffee' })
  render(<KivlyRewardCard gameId="ABC123" playerToken="token" />)
  expect(await screen.findByText(/pendiente de comprobación/)).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar premio' }))
  await screen.findByText(/pendiente de comprobación/)
  expect(publicApi.completionReward).toHaveBeenCalledTimes(2)
})

it('reports failures without claiming that the game result was lost', async () => {
  vi.mocked(publicApi.completionReward).mockRejectedValue(new Error('Unavailable'))
  render(<KivlyRewardCard gameId="ABC123" playerToken="token" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Tu resultado está guardado.')
})

it('translates reward status without translating its name', async () => {
  vi.mocked(publicApi.completionReward).mockResolvedValue({ status: 'confirmed', name: 'Coffee' })
  render(<ParticipantLanguageProvider><ParticipantLanguageSelector />
    <KivlyRewardCard gameId="ABC123" playerToken="token" />
  </ParticipantLanguageProvider>)
  await screen.findByText('Coffee')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
  expect(screen.getByText('Wallet pass not available yet.')).toBeInTheDocument()
  expect(screen.getByText('Coffee')).toBeInTheDocument()
})

it('does not display an empty card when no reward is configured', async () => {
  vi.mocked(publicApi.completionReward).mockResolvedValue({ status: 'none' })
  render(<KivlyRewardCard gameId="ABC123" playerToken="token" />)
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Tu premio del club' })).not.toBeInTheDocument())
})
