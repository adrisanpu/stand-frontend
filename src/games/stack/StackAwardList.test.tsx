import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import StackAwardList, { StackWallet } from './StackAwardList'
import type { StackPlayerPrizes } from '../../api/stackPrizes'
import { ParticipantLanguageProvider, ParticipantLanguageSelector } from '../../core/participant/participantLanguage'
import { fireEvent } from '@testing-library/react'

afterEach(cleanup)
const data: StackPlayerPrizes = {
  walletUrl: 'https://club.kivly.store/add-to-wallet?customer_id=customer&location_id=loc',
  state: 'open', finalPrizesPending: true, awards: [
    { id: 'a1', name: 'Pizza', source: 'stand', condition: 'completed', state: 'available', token: 'qr-one' },
    { id: 'a2', name: 'Pizza', source: 'stand', condition: 'top_finish', state: 'available', token: 'qr-two' },
    { id: 'a3', name: 'Coffee', source: 'kivly', condition: 'completed', state: 'confirmed' },
  ],
}
it('shows separate locally generated QR codes for two units of the same STAND prize', () => {
  render(<StackAwardList data={data} />)
  const qr = screen.getAllByRole('img', { name: 'QR Pizza' })
  expect(qr).toHaveLength(2)
  expect(qr[0].getAttribute('src')).not.toBe(qr[1].getAttribute('src'))
  expect(qr[0]).toHaveAttribute('src', expect.stringContaining('data:image/gif;base64,'))
  expect(screen.queryByRole('img', { name: 'QR Coffee' })).not.toBeInTheDocument()
  expect(screen.getByText('Asignado a tu cuenta del club. No necesitas reclamarlo aquí.')).toBeInTheDocument()
})
it('does not show a QR for an already collected prize', () => {
  render(<StackAwardList data={{ ...data, awards: [{ ...data.awards[0], state: 'delivered' }] }} />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('Premio recogido. ¡Disfrútalo!')).toBeInTheDocument()
})
it('opens the official wallet page without requiring a reward', () => {
  render(<StackWallet url={data.walletUrl} />)
  expect(screen.getByRole('link', { name: 'Añadir a mi wallet' })).toHaveAttribute('href', data.walletUrl)
})
it('rejects a wallet link outside the official Kivly storefront', () => {
  render(<StackWallet url="https://kivly.store.attacker.test/add-to-wallet" />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeInTheDocument()
})
it('explains an unavailable wallet instead of silently hiding an expected club card', () => {
  render(<StackWallet url={null} expected />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Tu tarjeta del club no está disponible aquí.')
})
it('translates the wallet and award states to English', () => {
  render(<ParticipantLanguageProvider><ParticipantLanguageSelector /><StackWallet url={data.walletUrl} /><StackAwardList data={data} /></ParticipantLanguageProvider>)
  fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })
  expect(screen.getByRole('link', { name: 'Add to my wallet' })).toBeInTheDocument()
  expect(screen.getByText('Your prizes')).toBeInTheDocument()
})
