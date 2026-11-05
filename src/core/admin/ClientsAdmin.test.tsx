import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getClientHistory, searchClients } from '../../api/clients'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import ClientsAdmin from './ClientsAdmin'

vi.mock('../../api/clients', () => ({
  getClientHistory: vi.fn(),
  searchClients: vi.fn(),
}))

const client = {
  id: 'b'.repeat(64), name: 'Ana', email: 'ana@example.com',
  phone: '+34600000000', participationCount: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(searchClients).mockResolvedValue({ clients: [client], page: 1, total: 1 })
  vi.mocked(getClientHistory).mockResolvedValue({
    client,
    participations: [{
      gameId: 'ABC123', gameName: 'Feria', gameType: 'STACK',
      joinedAt: null, name: 'Ana', phone: client.phone,
      awards: [
        {
          id: 'award_kivly', name: 'Membresía', imageUrl: 'https://example.com/prize.png', source: 'kivly', condition: null,
          awardedAt: null, awardState: 'confirmed', kivlyAssignmentState: 'confirmed',
          emailState: 'accepted', deliveryChannel: 'wallet', collected: false, collectedAt: null,
        },
        {
          id: 'award_stand', name: 'Entrada', source: 'stand', condition: null,
          awardedAt: null, awardState: 'delivered', kivlyAssignmentState: null,
          emailState: 'accepted', deliveryChannel: 'email', collected: true,
          collectedAt: '2026-11-04T10:00:00Z',
        },
      ],
    }],
  })
})

it('shows verified contact details and keeps prize, Kivly, email and collection states distinct', async () => {
  render(<OperatorLanguageProvider><ClientsAdmin /></OperatorLanguageProvider>)

  const entry = await screen.findByRole('button', { name: 'Ver historial de Ana' })
  expect(entry).toHaveTextContent('ana@example.com')
  expect(entry).toHaveTextContent('+34600000000')
  fireEvent.click(entry)

  const kivlyStatus = await screen.findByText('Asignación Kivly: Confirmada')
  const historyPanel = screen.getByRole('region', { name: 'Historial del cliente' })
  expect(entry.parentElement).toContainElement(historyPanel)
  expect(entry.nextElementSibling).toBe(historyPanel)
  expect(entry).toHaveAttribute('aria-expanded', 'true')
  expect(within(historyPanel).queryByText(client.email)).not.toBeInTheDocument()
  expect(within(historyPanel).queryByText(client.phone)).not.toBeInTheDocument()
  expect(within(historyPanel).queryByText(client.name)).not.toBeInTheDocument()
  expect(within(historyPanel).getByRole('button', { name: 'Cerrar' })).toHaveAttribute('data-tone', 'danger')
  expect(historyPanel.querySelector('img[src="https://example.com/prize.png"]')).toBeInTheDocument()
  expect(historyPanel.querySelector('img.h-8')).toBeInTheDocument()
  expect(kivlyStatus.closest('article')).not.toHaveTextContent('Recogido')
  expect(screen.getAllByText('Premio ganado')).toHaveLength(2)
  expect(screen.getAllByText('Email: Aceptado para envío')).toHaveLength(2)
  expect(screen.getByText('Recogida STAND: Recogido')).toBeInTheDocument()
  fireEvent.click(entry)
  expect(screen.queryByRole('region', { name: 'Historial del cliente' })).not.toBeInTheDocument()
  expect(entry).toHaveAttribute('aria-expanded', 'false')
})

it('opens history beneath the clicked row and closes the previous row', async () => {
  const second = { ...client, id: 'c'.repeat(64), name: 'Bea', email: 'bea@example.com' }
  vi.mocked(searchClients).mockResolvedValue({ clients: [client, second], page: 1, total: 2 })
  vi.mocked(getClientHistory).mockImplementation(async id => ({
    client: id === client.id ? client : second,
    participations: [{
      gameId: id === client.id ? 'FIRST' : 'SECOND',
      gameName: id === client.id ? 'Primera partida' : 'Segunda partida',
      gameType: 'STACK', joinedAt: null, name: null, phone: null, awards: [],
    }],
  }))
  render(<OperatorLanguageProvider><ClientsAdmin /></OperatorLanguageProvider>)
  const firstEntry = await screen.findByRole('button', { name: 'Ver historial de Ana' })
  const secondEntry = screen.getByRole('button', { name: 'Ver historial de Bea' })
  fireEvent.click(firstEntry)
  await screen.findByRole('heading', { name: 'Primera partida' })
  fireEvent.click(secondEntry)
  const heading = await screen.findByRole('heading', { name: 'Segunda partida' })
  const panel = screen.getByRole('region', { name: 'Historial del cliente' })
  expect(secondEntry.nextElementSibling).toBe(panel)
  expect(panel).toContainElement(heading)
  expect(firstEntry).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('heading', { name: 'Primera partida' })).not.toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }))
  expect(screen.queryByRole('region', { name: 'Historial del cliente' })).not.toBeInTheDocument()
})

it('navigates pages with arrows and filters all clients without fetching history', async () => {
  const second = { ...client, id: 'c'.repeat(64), name: 'Bea', email: 'bea@example.com' }
  vi.mocked(searchClients)
    .mockResolvedValueOnce({ clients: [client], page: 1, total: 26 })
    .mockResolvedValueOnce({ clients: [second], page: 2, total: 26 })
    .mockResolvedValueOnce({ clients: [client], page: 1, total: 26 })
    .mockResolvedValueOnce({ clients: [second], page: 1, total: 1 })
  render(<OperatorLanguageProvider><ClientsAdmin /></OperatorLanguageProvider>)
  await screen.findByRole('button', { name: 'Ver historial de Ana' })
  expect(searchClients).toHaveBeenCalledTimes(1)
  expect(screen.getByText('1-25 de 26')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  expect(getClientHistory).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await screen.findByRole('button', { name: 'Ver historial de Bea' })
  expect(searchClients).toHaveBeenLastCalledWith(2, '')
  expect(screen.getByText('26-26 de 26')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ver historial de Ana' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
  await screen.findByRole('button', { name: 'Ver historial de Ana' })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar clientes' }), { target: { value: 'Bea' } })
  await screen.findByRole('button', { name: 'Ver historial de Bea' })
  expect(searchClients).toHaveBeenLastCalledWith(1, 'Bea')
  expect(screen.getByText('1-1 de 1')).toBeInTheDocument()
  expect(getClientHistory).not.toHaveBeenCalled()
})
