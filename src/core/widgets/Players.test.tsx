import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Players from './Players'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import { prizeText } from '../../test/prizeText'

const state = vi.hoisted(() => ({ plan: 'event' }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ plan: state.plan }),
}))
vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  state.plan = 'event'
  vi.mocked(api.get).mockResolvedValue({
    ok: true, playerCount: 25, validatedCount: 3,
    settings: { empareja2: { maxValidations: 10 } },
  })
})
afterEach(cleanup)

it('translates the panel but preserves custom prize names', async () => {
  render(
    <OperatorLanguageProvider>
      <OperatorLanguageSelector />
      <Players gameName="Event" gameType="EMPAREJA2" compact countersOnly prizeLabel="Premio por pareja" />
    </OperatorLanguageProvider>
  )
  await screen.findByText('25')
  fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
  expect(screen.getByText('Players')).toBeInTheDocument()
  expect(screen.getByText(prizeText('PRIZE: Premio por pareja'))).toBeInTheDocument()
})

it.each([
  [true, true], [true, false], [false, true], [false, false],
])('places the count before the equally sized label (compact=%s, countersOnly=%s)', async (compact, countersOnly) => {
  render(<Players gameName="Event" gameType="EMPAREJA2" compact={compact} countersOnly={countersOnly} prizeLabel="Entrada" />)
  const count = await screen.findByText('25')
  const label = screen.getByText('Jugadores')
  const row = label.parentElement
  expect(row).toHaveClass('flex', 'items-center', 'gap-3')
  expect(row?.firstElementChild).toContainElement(count)
  expect(row?.firstElementChild).toHaveClass('items-start', 'text-left')
  expect(row?.lastElementChild).toBe(label)
  expect(label).toHaveClass('text-xl', 'sm:text-2xl')
  expect(count).toHaveClass('text-xl', 'sm:text-2xl', 'tabular-nums')
  expect(screen.getAllByText('Jugadores')).toHaveLength(1)
  expect(screen.getByText(prizeText('PREMIO: Entrada'))).toBeInTheDocument()
  const sticker = screen.getByText(prizeText('PREMIO: Entrada')).parentElement?.parentElement
  expect(sticker?.nextElementSibling).toHaveClass('card', compact ? 'p-2' : 'p-3')
  expect(sticker?.nextElementSibling).not.toHaveClass('pt-10')
  expect(screen.getByText('3/10')).toBeInTheDocument()
})

it.each([true, false])('preserves plan limits and warnings (countersOnly=%s)', async (countersOnly) => {
  state.plan = 'free'
  render(<Players gameName="Event" gameType="EMPAREJA2" compact countersOnly={countersOnly} />)
  expect(await screen.findByText('Límite alcanzado')).toBeInTheDocument()
  expect(screen.getAllByText('25')).toHaveLength(2)
  expect(screen.getByText('/')).toBeInTheDocument()
})
