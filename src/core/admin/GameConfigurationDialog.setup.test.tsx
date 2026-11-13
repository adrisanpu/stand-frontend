import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../../api/api'
import { SETUP_REVIEW_SECTIONS, type SetupReviewProgress } from '../../api/operatorGames'
import GameConfigurationDialog from './GameConfigurationDialog'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const user = vi.hoisted(() => ({ plan: 'event' }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => user }))
vi.mock('../shell/GameGate', () => ({
  default: ({ onGameCreated }: { onGameCreated: (name: string, id: string) => void }) =>
    <button onClick={() => onGameCreated('Event', 'NEW')}>Create test event</button>,
}))
vi.mock('./GameFormSettings', () => ({
  default: function MockGameFormSettings({ onReadyChange, onSectionDirtyChange, section }: {
    onReadyChange: (section: 'appearance' | 'registration' | 'questionnaire', ready: boolean) => void
    onSectionDirtyChange: (section: 'appearance' | 'registration' | 'questionnaire', dirty: boolean) => void
    section: 'appearance' | 'registration' | 'questionnaire'
  }) {
    useEffect(() => {
      onReadyChange('appearance', true)
      onReadyChange('registration', true)
      onReadyChange('questionnaire', true)
    }, [onReadyChange])
    return <div>
      <button onClick={() => { onSectionDirtyChange(section, true); onReadyChange(section, false) }}>Edit panel</button>
      <button onClick={() => { onSectionDirtyChange(section, false); onReadyChange(section, true) }}>Save panel</button>
      <button onClick={() => onReadyChange(section, false)}>Fail panel load</button>
    </div>
  },
}))
vi.mock('./RewardConditions', () => ({
  default: function MockRewardConditions({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
    useEffect(() => { onReadyChange(true) }, [onReadyChange])
    return <p>Reward settings</p>
  },
}))
vi.mock('../widgets/Raffle', () => ({
  default: function MockRaffle({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
    useEffect(() => { onReadyChange(true) }, [onReadyChange])
    return <p>Raffle settings</p>
  },
}))
vi.mock('./GamePlayPreview', () => ({ default: () => <p>Local trial</p> }))

let progress: SetupReviewProgress | undefined
let failWrite: boolean
beforeEach(() => {
  vi.clearAllMocks()
  user.plan = 'event'
  failWrite = false
  progress = { version: 1, revision: 'r1', confirmedSections: [], completed: false }
  vi.mocked(api.get).mockImplementation(async () => ({
    ok: true, game: { gameId: 'NEW', gameName: 'Event', gameType: 'T1MER', isActive: true,
      lifecycleState: 'active', ...(progress ? { setupReview: progress } : {}) }, configuration: {}, rewardConditionsRevision: 'prizes-1',
  }))
  vi.mocked(api.put).mockImplementation(async (_path, raw) => {
    if (failWrite) throw new Error('SetupReviewChanged')
    const body = raw as { setupReview: { section?: typeof SETUP_REVIEW_SECTIONS[number]; confirmed?: boolean; finish?: boolean; expectedRevision: string } }
    if (!progress || body.setupReview.expectedRevision !== progress.revision) throw new Error('Stale revision')
    const { section, confirmed, finish } = body.setupReview
    progress = {
      ...progress, revision: progress.revision + 'x',
      confirmedSections: section
        ? SETUP_REVIEW_SECTIONS.filter(id => id === section ? confirmed : progress!.confirmedSections.includes(id))
        : progress.confirmedSections,
      completed: finish === true,
    }
    return { ok: true, gameId: 'NEW', setupReview: progress }
  })
})
afterEach(cleanup)

function mount(create = false, requireSetup = false) {
  const close = vi.fn()
  const result = render(<MemoryRouter><GameConfigurationDialog gameId={create ? undefined : 'NEW'} gameType="T1MER" requireSetup={requireSetup} onClose={close} /></MemoryRouter>)
  return { close, ...result }
}
const confirm = () => screen.getByRole('button', { name: 'Confirmar panel y continuar' })

it('opens new events in Home, requires all six explicit confirmations and only then finishes', async () => {
  const { close } = mount(true)
  fireEvent.click(screen.getByRole('button', { name: 'Create test event' }))
  await waitFor(() => expect(confirm()).toBeEnabled())
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    'Home', 'Registro', 'Juego', 'Cuestionario', 'Premios', 'Sorteo',
  ])
  expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  expect(screen.getByRole('button', { name: 'Finalizar configuración' })).toBeDisabled()
  const reviewOrder = ['Home', 'Registro', 'Juego', 'Cuestionario', 'Premios', 'Sorteo']
  for (let index = 0; index < reviewOrder.length; index++) {
    expect(screen.getByRole('tab', { name: reviewOrder[index] })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(confirm()).toBeEnabled())
    await act(async () => { fireEvent.click(confirm()) })
    expect(progress?.confirmedSections).toHaveLength(index + 1)
    if (reviewOrder[index + 1]) {
      await waitFor(() => expect(screen.getByRole('tab', { name: reviewOrder[index + 1] })).toHaveAttribute('aria-selected', 'true'))
    }
  }
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar configuración' }))
  await waitFor(() => expect(close).toHaveBeenCalledWith(true))
  expect(api.put).toHaveBeenCalledTimes(7)
  expect(progress?.completed).toBe(true)
})

it('resumes the first pending panel and preserves review progress across remounts', async () => {
  progress!.confirmedSections = ['appearance', 'configuration']
  const first = mount()
  await screen.findByRole('tab', { name: 'Registro' })
  expect(screen.getByRole('tab', { name: 'Registro' })).toHaveAttribute('aria-selected', 'true')
  await act(async () => { fireEvent.click(confirm()) })
  first.unmount()
  mount()
  await screen.findByRole('tab', { name: 'Cuestionario' })
  expect(screen.getByRole('tab', { name: 'Cuestionario' })).toHaveAttribute('aria-selected', 'true')
  expect(progress?.confirmedSections).toEqual(['appearance', 'form', 'configuration'])
})

it('blocks closing a resumed setup while the server progress is still loading', () => {
  vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
  const { close } = mount(false, true)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
})

it('invalidates an already confirmed panel on edit and saving does not confirm it again', async () => {
  progress!.confirmedSections = ['appearance']
  mount()
  await screen.findByRole('tab', { name: /Home/ })
  fireEvent.click(screen.getByRole('tab', { name: /Home/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit panel' }))
  await waitFor(() => expect(progress?.confirmedSections).toEqual([]))
  expect(confirm()).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Save panel' }))
  expect(confirm()).toBeEnabled()
  expect(progress?.confirmedSections).toEqual([])
})

it('blocks review on load failures and recovers failed writes by reloading server progress', async () => {
  mount()
  await waitFor(() => expect(confirm()).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Fail panel load' }))
  expect(confirm()).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Save panel' }))
  failWrite = true
  fireEvent.click(confirm())
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el panel')
  expect(confirm()).toBeDisabled()
  failWrite = false
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recargar progreso' })) })
  expect(confirm()).toBeEnabled()
  await act(async () => { fireEvent.click(confirm()) })
  expect(progress?.confirmedSections).toEqual(['appearance'])
})

it('allows confirming plan-limited panels without buying a plan or running a raffle', async () => {
  user.plan = 'free'
  progress!.confirmedSections = SETUP_REVIEW_SECTIONS.filter(id => id !== 'prizes')
  mount()
  await waitFor(() => expect(confirm()).toBeEnabled())
  expect(screen.getByText('Disponible en el plan Event 24h.')).toBeInTheDocument()
  await act(async () => { fireEvent.click(confirm()) })
  expect(progress?.confirmedSections).toHaveLength(6)
})

it('leaves legacy events exempt, opens in Home and allows closing normally', async () => {
  progress = undefined
  const { close } = mount()
  await screen.findByRole('tab', { name: 'Home' })
  expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('button', { name: 'Confirmar panel y continuar' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  expect(close).toHaveBeenCalledWith(false)
})
