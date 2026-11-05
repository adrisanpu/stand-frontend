import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import StackAwardList, { StackWallet } from './StackAwardList'
import type { StackPlayerPrizes } from '../../api/stackPrizes'
import { ParticipantLanguageProvider, ParticipantLanguageSelector } from '../../core/participant/participantLanguage'
import { fireEvent } from '@testing-library/react'

afterEach(cleanup)
it('explains omitted prizes compactly using backend inventory reasons in both languages', () => {
  render(<ParticipantLanguageProvider><ParticipantLanguageSelector /><StackAwardList data={{
    walletUrl: null, state: 'closed', finalPrizesPending: false, awards: [],
    inventoryReasons: {
      pizza: 'InventoryNotInitialized', coffee: 'InventoryOutOfStock',
      gift: 'EventLimitReached', duplicate: 'InventoryOutOfStock',
    },
  }} /></ParticipantLanguageProvider>)
  const reason = screen.getByRole('status')
  expect(reason).toHaveTextContent('El stock del premio no está inicializado.')
  expect(reason).toHaveTextContent('Se ha agotado el stock compartido del premio.')
  expect(reason).toHaveTextContent('Se ha alcanzado el límite de premios de esta partida.')
  expect(reason.textContent?.match(/Se ha agotado/g)).toHaveLength(1)
  expect(screen.queryByText('Todavía no tienes premios asignados.')).not.toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })
  expect(screen.getByRole('status')).toHaveTextContent('Prize stock has not been initialized.')
  expect(screen.getByRole('status')).toHaveTextContent('Shared prize stock is exhausted.')
  expect(screen.getByRole('status')).toHaveTextContent('The event prize cap has been reached.')
})

it('keeps already earned awards visible beside omitted-award reasons', () => {
  render(<StackAwardList data={{ ...data, inventoryReasons: { coffee: 'InventoryOutOfStock' } }} />)
  expect(screen.getByText('Se ha agotado el stock compartido del premio.')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'QR Pizza' })).toHaveLength(2)
})

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
it.each(['queued', 'sending', 'reconciliation_required'] as const)('shows email blocked before the %s reward is confirmed without offering retry', (state) => {
  render(<ParticipantLanguageProvider><ParticipantLanguageSelector /><StackAwardList data={{
    ...data, deliveryChannel: 'email', awards: [{
      ...data.awards[2], state, deliveryChannel: 'email', emailState: 'blocked',
    }],
  }} /></ParticipantLanguageProvider>)
  expect(screen.getByText('Premio pendiente de confirmación; correo aún no encolado')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })
  expect(screen.getByText('Reward awaiting confirmation; email not yet queued')).toBeInTheDocument()
})
it('distinguishes SES acceptance from confirmed inbox delivery in both languages', () => {
  render(<ParticipantLanguageProvider><ParticipantLanguageSelector /><StackAwardList data={{
    ...data, deliveryChannel: 'email', awards: [{
      ...data.awards[2], deliveryChannel: 'email', emailState: 'accepted',
    }],
  }} /></ParticipantLanguageProvider>)
  expect(screen.getByText(/aceptado por SES; entrega en bandeja no confirmada/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })
  expect(screen.getByText(/accepted by SES; inbox delivery is not confirmed/)).toBeInTheDocument()
})
it('opens the official wallet page without requiring a reward', () => {
  render(<StackWallet url={data.walletUrl} />)
  const wallet = screen.getByRole('link', { name: 'Añadir a mi wallet del club' })
  expect(wallet).toHaveAttribute('href', data.walletUrl)
  expect(wallet).toHaveClass('wallet-highlight')
  expect(wallet.querySelector('svg')).not.toBeNull()
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
  expect(screen.getByRole('link', { name: 'Add to my club wallet' })).toBeInTheDocument()
  expect(screen.getByText('Your prizes')).toBeInTheDocument()
})
