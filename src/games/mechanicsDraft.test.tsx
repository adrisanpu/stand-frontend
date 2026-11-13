import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/api'
import T1merGameConfig from './t1mer/GameConfig'
import StackGameConfig from './stack/GameConfig'
import Rulet4GameConfig from './rulet4/GameConfig'
import L3trasGameConfig from './l3tras/GameConfig'
import Empareja2GameConfig from './empareja2/GameConfig'
import ImpostorGameConfig from './impostor/GameConfig'
import InfocardsGameConfig from './infocards/GameConfig'
import { DEFAULT_STACK_CONFIG } from './stack/stackLogic'
import { DEFAULT_RULET4_CONFIG } from './rulet4/rulet4Logic'

vi.mock('../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('./stack/BlockPreview', () => ({ default: () => null }))

describe('mechanics drafts are distinct from save notifications', () => {
  const onChange = vi.fn()
  const onDraftChange = vi.fn()
  const props = { gameId: 'DEMO', gameName: 'Demo', settingsLoaded: true, onChange, onDraftChange }
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits T1MER initial loaded settings and local edits without a second load', () => {
    render(<T1merGameConfig {...props} settings={{}} />)
    expect(onDraftChange).toHaveBeenLastCalledWith({ emailRequired: true })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onDraftChange).toHaveBeenLastCalledWith({ emailRequired: false })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('emits complete STACK rules, including unsaved invalid values', () => {
    render(<StackGameConfig {...props} settings={DEFAULT_STACK_CONFIG} />)
    expect(onDraftChange).toHaveBeenLastCalledWith(DEFAULT_STACK_CONFIG)
    fireEvent.change(screen.getByLabelText('Velocidad inicial'), { target: { value: '-1' } })
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...DEFAULT_STACK_CONFIG, initialSpeed: -1 })
  })

  it('emits roulette initial panels and edited labels before save', () => {
    render(<Rulet4GameConfig {...props} settings={DEFAULT_RULET4_CONFIG} />)
    expect(onDraftChange).toHaveBeenLastCalledWith(DEFAULT_RULET4_CONFIG)
    fireEvent.change(screen.getByDisplayValue('Rojo'), { target: { value: 'Borrador' } })
    expect(onDraftChange).toHaveBeenLastCalledWith({
      panels: [{ ...DEFAULT_RULET4_CONFIG.panels[0], label: 'Borrador' }, ...DEFAULT_RULET4_CONFIG.panels.slice(1)],
    })
  })

  it('emits L3TRAS word/time drafts without silently replacing invalid values', () => {
    render(<L3trasGameConfig {...props} settings={{ objectiveWord: 'UNO', validationTimeLimitSeconds: 30 }} />)
    expect(onDraftChange).toHaveBeenLastCalledWith({ objectiveWord: 'UNO', validationTimeLimitSeconds: 30 })
    fireEvent.change(screen.getByLabelText('Palabra objetivo'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Tiempo para completar la palabra (segundos)'), { target: { value: '0' } })
    expect(onDraftChange).toHaveBeenLastCalledWith({ objectiveWord: '', validationTimeLimitSeconds: 0 })
  })

  it('preserves the existing L3TRAS empty-word save validation', () => {
    const registerSave = vi.fn()
    render(<L3trasGameConfig {...props} settings={{ objectiveWord: '' }} registerSave={registerSave} />)
    expect(registerSave.mock.lastCall?.[0].validate()).toBe('La palabra objetivo no puede estar vacía')
  })

  it('emits EMPAREJA2 pool size and edits', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, pairs: [] })
    render(<Empareja2GameConfig {...props} settings={{ numPairs: 4, catalogPairCount: 20 }} />)
    expect(onDraftChange).toHaveBeenLastCalledWith({ numPairs: 4, catalogPairCount: 20 })
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } })
    expect(onDraftChange).toHaveBeenLastCalledWith({ numPairs: 8, catalogPairCount: 20 })
    expect(await screen.findByText('No hay parejas disponibles.')).toBeInTheDocument()
  })

  it('emits IMPOSTOR words/player count, including an invalid empty word list', () => {
    render(<ImpostorGameConfig {...props} settings={{ words: ['Inicial'], maxPlayers: 4 }} />)
    expect(onDraftChange).toHaveBeenLastCalledWith({ words: ['Inicial'], maxPlayers: 4 })
    fireEvent.change(screen.getByLabelText('Palabras (una por línea)'), { target: { value: '' } })
    expect(onDraftChange).toHaveBeenLastCalledWith({ words: [], maxPlayers: 4 })
  })

  it('emits loaded INFOCARDS content and unsaved edits from the existing read-only load', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, gameId: 'DEMO', cards: [{ id: 'a', title: 'Inicial', body: 'Texto' }] })
    render(<InfocardsGameConfig {...props} settings={{}} />)
    expect(onDraftChange).toHaveBeenCalledWith(null)
    await screen.findByDisplayValue('Inicial')
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      cards: [expect.objectContaining({ id: 'a', title: 'Inicial', body: 'Texto' })],
    }))
    fireEvent.change(screen.getByDisplayValue('Inicial'), { target: { value: 'Sin guardar' } })
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      cards: [expect.objectContaining({ title: 'Sin guardar' })],
    }))
  })

  it('emits null during loading and does not publish fallback defaults after a failed load', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Sin conexión'))
    render(<L3trasGameConfig {...props} settingsLoaded={false} settings={{}} />)
    expect(onDraftChange).toHaveBeenLastCalledWith(null)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión'))
    expect(onDraftChange).toHaveBeenCalledTimes(1)
  })
})
