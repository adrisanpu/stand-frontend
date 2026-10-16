import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileParticipantsPanel from './MobileParticipantsPanel'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Single event screen participant links', () => {
  it('only links to participant play, not a second event screen', () => {
    render(<MobileParticipantsPanel gameId="YFAUHN" gameName="PIZZA" />)
    expect(screen.getByRole('link', { name: 'Abrir enlace participante' })).toHaveAttribute('href', `${window.location.origin}/play/YFAUHN`)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByText(/pantalla pública/i)).not.toBeInTheDocument()
    expect(screen.getByText('Esta es la pantalla del evento. Los participantes se registran y juegan desde su móvil.')).toBeInTheDocument()
  })

  it('copies only the participant URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<MobileParticipantsPanel gameId="YFAUHN" gameName="PIZZA" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace participante' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Enlace copiado.')
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/play/YFAUHN`)
  })
})
