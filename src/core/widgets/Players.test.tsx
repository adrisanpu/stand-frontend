import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Players from './Players'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'

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
  expect(screen.getByText('Prize: Premio por pareja')).toBeInTheDocument()
})

it.each([
  [true, true], [true, false], [false, true], [false, false],
])('aligns label left and larger count right (compact=%s, countersOnly=%s)', async (compact, countersOnly) => {
  render(<Players gameName="Event" gameType="EMPAREJA2" compact={compact} countersOnly={countersOnly} prizeLabel="Entrada" />)
  const count = await screen.findByText('25')
  const label = screen.getByText('Jugadores')
  const row = label.parentElement
  expect(row).toHaveClass('flex', 'items-center', 'justify-between')
  expect(row?.firstElementChild).toBe(label)
  expect(row?.lastElementChild).toContainElement(count)
  expect(row?.lastElementChild).toHaveClass('items-end', 'text-right')
  expect(label).toHaveClass(compact ? 'text-lg' : 'text-xl')
  expect(count).toHaveClass(compact ? 'text-2xl' : 'text-3xl', 'tabular-nums')
  expect(screen.getAllByText('Jugadores')).toHaveLength(1)
  expect(screen.getByText('Premio: Entrada')).toBeInTheDocument()
  expect(screen.getByText('3/10')).toBeInTheDocument()
})

it.each([true, false])('preserves plan limits and warnings (countersOnly=%s)', async (countersOnly) => {
  state.plan = 'free'
  render(<Players gameName="Event" gameType="EMPAREJA2" compact countersOnly={countersOnly} />)
  expect(await screen.findByText('Límite alcanzado')).toBeInTheDocument()
  expect(screen.getAllByText('25')).toHaveLength(2)
  expect(screen.getByText('/')).toBeInTheDocument()
})
