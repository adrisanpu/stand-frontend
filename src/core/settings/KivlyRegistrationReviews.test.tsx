import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { kivlyApi, type KivlyRegistrationReview } from '../../api/kivlyApi'
import GamePlayersSettings from './GamePlayersSettings'
import KivlyRegistrationReviews from './KivlyRegistrationReviews'
import { api } from '../../api/api'

vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { listRegistrationReviews: vi.fn(), approveRegistration: vi.fn() } }))
vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const request: KivlyRegistrationReview = {
  requestId: 'request-1', username: 'Ana', email: 'ana@test.com', phone: '+34612345678',
  customer: { name: 'Ana Club', email: null, phone: '+34612345678' }, state: 'review_required',
}

async function load() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Revisar identidades Kivly' })) })
}

describe('operator Kivly identity review', () => {
  it('is reachable from the existing players surface without an automatic identity request', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, players: [] })
    render(<GamePlayersSettings gameId="GAME1" onBack={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText('Todavía no hay jugadores en esta partida.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar identidades Kivly' })).toBeInTheDocument()
    expect(kivlyApi.listRegistrationReviews).not.toHaveBeenCalled()
    expect(kivlyApi.approveRegistration).not.toHaveBeenCalled()
  })

  it('shows both profiles and only approves after explicit confirmation, with a loading guard', async () => {
    vi.mocked(kivlyApi.listRegistrationReviews).mockResolvedValue([request])
    let finish!: () => void
    vi.mocked(kivlyApi.approveRegistration).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<KivlyRegistrationReviews gameId="GAME1" />)
    await load()
    expect(screen.getByText('Ana Club')).toBeInTheDocument()
    expect(screen.getByText('Email: —')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar identidad' }))
    expect(kivlyApi.approveRegistration).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(kivlyApi.approveRegistration).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar identidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar identidad y vincular' }))
    expect(kivlyApi.approveRegistration).toHaveBeenCalledOnce()
    expect(kivlyApi.approveRegistration).toHaveBeenCalledWith('GAME1', 'request-1')
    expect(screen.getByRole('button', { name: 'Vinculando...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actualizar identidades' })).toBeDisabled()
    await act(async () => { finish() })
    expect(screen.queryByText('Ana Club')).not.toBeInTheDocument()
    expect(screen.getByText('No hay identidades pendientes de revisión.')).toBeInTheDocument()
  })

  it('shows safe list and approval failures without removing the pending identity', async () => {
    vi.mocked(kivlyApi.listRegistrationReviews).mockRejectedValueOnce(new Error('private'))
      .mockResolvedValueOnce([request])
    vi.mocked(kivlyApi.approveRegistration).mockRejectedValue(new Error('private'))
    render(<KivlyRegistrationReviews gameId="GAME1" />)
    await load()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar')
    await load()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar identidad' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar identidad y vincular' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('Actualiza la lista')
    expect(screen.getByText('Ana Club')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar identidad y vincular' })).not.toBeInTheDocument()
  })
})
