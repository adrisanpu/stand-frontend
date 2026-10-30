import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Ranking from './Ranking'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import { prizeText } from '../../test/prizeText'

vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
afterEach(cleanup)

describe('Ranking game score formatting', () => {
  it.each([true, false])('shows profile photos or initial avatars (compact=%s)', async (compact) => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      results: [
        { rank: 1, username: 'Rosa', score: 3 },
        { rank: 2, username: 'Luis', score: 2, profilePicUrl: '   ' },
        { rank: 3, username: 'Ana', score: 1, profilePicUrl: '/ana.png' },
      ],
    })
    const { container } = render(<Ranking gameId="GAME1234" gameType="STACK" compact={compact} />)
    await screen.findByText('Rosa')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')).toHaveAttribute('src', '/ana.png')
    expect(screen.getByText('Rosa').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('R')
    expect(screen.getByText('Luis').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('L')
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('Ana').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('A')
  })

  it.each([true, false])('uses a centered prize sticker while retaining ranking rows and scrolling (compact=%s)', async (compact) => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      results: Array.from({ length: 12 }, (_, index) => ({ rank: index + 1, username: `Player ${index + 1}`, score: index })),
    })
    render(<Ranking gameId="GAME1234" gameType="STACK" compact={compact}
      prize={{ name: 'Copa', limit: 20, topX: 2, imageUrl: '/cup.png' }} />)
    const label = await screen.findByText(prizeText('PREMIO TOP 2: Copa'))
    const sticker = label.parentElement?.parentElement
    expect(sticker).toHaveClass('self-end', compact ? 'h-16' : 'h-20', compact ? '-mb-8' : '-mb-10')
    expect(sticker?.nextElementSibling).toHaveClass('card', 'flex-1', 'min-h-0', compact ? 'p-2' : 'p-3')
    expect(sticker?.nextElementSibling).not.toHaveClass('h-full', 'pt-10')
    expect(screen.getByRole('img', { name: 'Copa' })).toHaveClass('object-contain', 'h-full')
    expect(sticker).toHaveTextContent('12/20')
    expect(screen.getAllByLabelText('Premio')).toHaveLength(2)
    expect(screen.getByText('+2 más').parentElement).toHaveClass('overflow-y-auto', 'flex-1', 'min-h-0')
    expect(api.get).toHaveBeenCalledWith('/v1/game/score?gameId=GAME1234&limit=20')
  })

  it('translates Top X without translating the prize name and removes absent artwork', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [] })
    const { rerender } = render(
      <OperatorLanguageProvider>
        <OperatorLanguageSelector />
        <Ranking gameId="GAME1234" prize={{ name: 'Copa', limit: null, topX: 3 }} />
      </OperatorLanguageProvider>,
    )
    await screen.findByText(prizeText('PREMIO TOP 3: Copa'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    expect(screen.getByText(prizeText('TOP PRIZE 3: Copa'))).toBeInTheDocument()
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
    rerender(<Ranking gameId="GAME1234" prize={{ name: '', limit: null }} />)
    await screen.findByText('No hay puntuaciones aún')
    expect(screen.queryByText(/PRIZE|PREMIO/)).not.toBeInTheDocument()
  })

  it('shows STACK score in bloques, including zero, without timer units', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', score: 0 }] })
    render(<Ranking gameId="GAME1234" gameType="STACK" />)
    expect(await screen.findByText('0 bloques')).toBeInTheDocument()
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })

  it('keeps T1MER time formatting unchanged', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', timer: 10.1, score: 100 }] })
    render(<Ranking gameId="GAME1234" gameType="T1MER" />)
    expect(await screen.findByText('10.100s')).toBeInTheDocument()
    expect(screen.queryByText(/bloques$/)).not.toBeInTheDocument()
  })
})
