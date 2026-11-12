import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import { getGameForm, saveGameForm } from '../../api/gameForms'
import { uploadLibraryImage, uploadLogo } from '../../api/userMedia'
import { formDraft, validateFormDraft, type GameFormResponse } from '../formConfig'
import GameFormSettings from './GameFormSettings'
import { initialHomeCanvas } from '../home/canvasModel'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
const user = vi.hoisted(() => ({ plan: 'event' }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => user }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <span data-testid="qr">{data}</span> }))
let snapshot: GameFormResponse
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  user.plan = 'event'
  snapshot = {
    ok: true, gameId: 'EVENT', gameType: 'T1MER', revision: 'r1', readOnly: false, locked: false,
    joinUrl: 'https://playstand.app/play/EVENT', logoUrl: null, bannerUrl: null,
    formConfig: { registrationTitle: 'Join us', registrationDescription: '', quizTitle: 'Tell us',
      quizDescription: '', appearance: null, logoKey: null, bannerKey: null, quizMoment: 'disabled' },
    participantFields: { email: { required: true }, phone: { enabled: false, required: false } },
    questions: [],
  }
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.endsWith('&home=true')) return {
      ok: true, gameId: 'EVENT', gameType: 'T1MER', readOnly: false, homeRevision: 'home-one',
      homeCanvas: initialHomeCanvas(true, true), homeBackgroundUrls: { landscape: null, portrait: null },
    }
    if (path === '/v1/user/media') return { ok: true, logo: { items: [
      { id: 'image', key: 'users/owner/logos/image.png', name: 'Saved image', url: 'https://image.test/signed.png' },
    ], selectedId: null, selected: null } }
    return structuredClone(snapshot)
  })
  vi.mocked(api.put).mockImplementation(async (_path, body) => {
    const request = body as { form: ReturnType<typeof formDraft> }
    snapshot = { ...snapshot, ...request.form, revision: 'r2' }
    return structuredClone(snapshot)
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function mount() {
  const dirty = vi.fn()
  const busy = vi.fn()
  render(<GameFormSettings gameId="EVENT" onDirtyChange={dirty} onBusyChange={busy} />)
  await screen.findByLabelText('Título del registro')
  return { dirty, busy }
}

it('loads the selected event and saves keys and expected revision, not signed URLs', async () => {
  const { dirty } = await mount()
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=EVENT&form=true')
  fireEvent.change(screen.getByLabelText('Título del registro'), { target: { value: 'Our event' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  expect(await screen.findByText('Formulario guardado y confirmado.')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'EVENT', form: {
    ...formDraft(snapshot), expectedRevision: 'r1',
  } })
  expect(JSON.stringify(vi.mocked(api.put).mock.calls)).not.toContain('signed.png')
  expect(dirty).toHaveBeenLastCalledWith(false)
  expect(screen.getByTestId('qr')).toHaveTextContent('/play/EVENT')
})

it('previews the same two-step registration and optional fields that are saved for Play', async () => {
  await mount()
  const preview = within(screen.getByRole('tabpanel', { name: 'Registro' }))
  expect(preview.getByLabelText('Email *')).toBeRequired()
  expect(preview.queryByLabelText('Nombre completo *')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Empresa (opcional)' }))
  fireEvent.change(preview.getByLabelText('Email *'), { target: { value: 'a@example.com' } })
  fireEvent.click(preview.getByRole('button', { name: 'Continuar' }))
  expect(preview.getByLabelText('Nombre completo *')).toBeRequired()
  expect(preview.getByLabelText('Teléfono *')).toBeRequired()
  expect(preview.getByLabelText('Empresa (opcional)')).not.toBeRequired()
  expect(preview.queryByLabelText('Cargo (opcional)')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  await screen.findByText('Formulario guardado y confirmado.')
  expect(snapshot.participantFields).toMatchObject({
    email: { required: true }, phone: { enabled: true, required: true }, company: { enabled: true },
  })
})

it('keeps unsaved changes on failure and requires explicit reload before retry', async () => {
  await mount()
  vi.mocked(api.put).mockRejectedValue(new Error('FormChanged'))
  fireEvent.change(screen.getByLabelText('Título del registro'), { target: { value: 'Unsaved title' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('FormChanged')
  expect(screen.getByLabelText('Título del registro')).toHaveValue('Unsaved title')
  expect(screen.getByRole('button', { name: 'Guardar formulario' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar formulario' }))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.getByLabelText('Título del registro')).toHaveValue('Unsaved title')
  fireEvent.click(screen.getByRole('button', { name: 'Recargar formulario' }))
  fireEvent.click(screen.getByRole('button', { name: 'Recargar y descartar' }))
  await waitFor(() => expect(screen.getByLabelText('Título del registro')).toHaveValue('Join us'))
})

it('locks questions and timing after answers but allows presentation saves', async () => {
  snapshot.locked = true
  snapshot.formConfig.quizMoment = 'after_registration'
  snapshot.questions = [{ id: 'q1', text: 'Choose', options: [{ title: 'One', payload: 'EVENT_q1_a' }] }]
  await mount()
  expect(screen.getByLabelText('Momento del cuestionario')).toBeDisabled()
  expect(screen.getByLabelText('Texto de la pregunta 1')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Añadir pregunta' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Título del registro'), { target: { value: 'New heading' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  await screen.findByText('Formulario guardado y confirmado.')
  expect(snapshot.questions[0].text).toBe('Choose')
  expect(snapshot.formConfig.quizMoment).toBe('after_registration')
})

it('enforces plan, read-only and mandatory phone constraints', async () => {
  snapshot.gameType = 'STACK'
  await mount()
  expect(screen.getByText(/nombre completo y teléfono obligatorios/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Solicitar teléfono')).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Dirección (opcional)' })).not.toBeChecked()
  cleanup()
  user.plan = 'free'
  await mount()
  expect(screen.getByLabelText('Título del registro')).not.toBeDisabled()
  expect(screen.getByLabelText('Momento del cuestionario')).toBeDisabled()
  expect(screen.queryByLabelText('Subir logo')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar respuestas' })).toBeDisabled()
  cleanup()
  user.plan = 'event'
  snapshot.readOnly = true
  await mount()
  expect(screen.getByLabelText('Título del registro')).toBeDisabled()
})

it('previews radio answers locally without writes and rejects unavailable after-game timing', async () => {
  snapshot.gameType = 'INFOCARDS'
  snapshot.questions = [{ id: 'q1', text: 'Choose', options: [
    { title: 'One', payload: 'EVENT_q1_a' }, { title: 'Two', payload: 'EVENT_q1_b' },
  ] }]
  await mount()
  expect(screen.getByRole('option', { name: 'Después del juego' })).toBeDisabled()
  fireEvent.click(screen.getByRole('tab', { name: 'Cuestionario' }))
  fireEvent.click(screen.getByRole('radio', { name: 'One' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Two' }))
  expect(screen.getByRole('radio', { name: 'One' })).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'Two' })).toBeChecked()
  expect(api.put).not.toHaveBeenCalled()
  expect(api.post).not.toHaveBeenCalled()
})

it('generates only a local draft and saves canonical question IDs explicitly', async () => {
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Añadir pregunta' }))
  fireEvent.change(screen.getByLabelText('Texto de la pregunta 1'), { target: { value: 'Manual question' } })
  fireEvent.change(screen.getByLabelText('Opción 1.1'), { target: { value: 'One' } })
  fireEvent.change(screen.getByLabelText('Opción 1.2'), { target: { value: 'Two' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  await screen.findByText('Formulario guardado y confirmado.')
  expect(snapshot.questions[0].id).toBe('q1')
  expect(snapshot.questions[0].options[0].payload).toBe('EVENT_q1_a')
  vi.mocked(api.put).mockClear()
  vi.mocked(api.post).mockResolvedValue({ ok: true, gameId: 'EVENT',
    questions: [{ id: 'q1', text: 'Generated', options: [{ title: 'Answer', payload: 'EVENT_q1_a' }] }] })
  fireEvent.click(screen.getByText('Generar borrador con IA'))
  fireEvent.change(screen.getByLabelText('Tema del cuestionario'), { target: { value: 'Our brand' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generar preguntas' }))
  await waitFor(() => expect(screen.getByLabelText('Texto de la pregunta 1')).toHaveValue('Generated'))
  expect(api.post).toHaveBeenCalledWith('/v1/game/quiz/generate', {
    gameId: 'EVENT', text: 'Our brand', numQuestions: 3, numOptions: 3, useEmojis: false, draftOnly: true,
  })
  expect(api.put).not.toHaveBeenCalled()
})

it('rejects invalid questions and malformed/unconfirmed API responses', async () => {
  expect(validateFormDraft(formDraft(snapshot))).toBeNull()
  snapshot.formConfig.quizMoment = 'prize'
  expect(validateFormDraft(formDraft(snapshot))).toContain('Añade una pregunta')
  snapshot.questions = Array.from({ length: 6 }, (_, index) => ({ id: `q${index}`, text: 'Question', options: [] }))
  expect(validateFormDraft(formDraft(snapshot))).toContain('5 preguntas')
  vi.mocked(api.get).mockResolvedValue({ ok: true, gameId: 'EVENT' })
  await expect(getGameForm('EVENT')).rejects.toThrow('Invalid game form response')
  snapshot.questions = []
  snapshot.formConfig.quizMoment = 'disabled'
  vi.mocked(api.put).mockResolvedValue({ ...snapshot, gameId: 'OTHER' })
  await expect(saveGameForm('EVENT', formDraft(snapshot), 'r1')).rejects.toThrow('Invalid game form response')
})

it('retains unchanged legacy options for presentation saves but rejects new oversized questions', async () => {
  snapshot.locked = true
  snapshot.questions = [{ id: 'legacy-id', text: 'Legacy', options: ['A', 'B', 'C', 'D'].map(title => ({ title, payload: title })) }]
  const previous = structuredClone(snapshot.questions)
  expect(validateFormDraft(formDraft(snapshot))).toContain('1 y 3')
  expect(validateFormDraft(formDraft(snapshot), previous)).toBeNull()
  await mount()
  fireEvent.change(screen.getByLabelText('Título del registro'), { target: { value: 'New presentation' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar formulario' }))
  await screen.findByText('Formulario guardado y confirmado.')
  expect(snapshot.questions).toEqual(previous)
})

it('registers library uploads without selecting a global logo and preserves legacy upload selection', async () => {
  const file = new File(['image'], 'logo.png', { type: 'image/png' })
  const meta = { id: 'image', key: 'users/owner/logos/image.png', kind: 'logo' as const,
    name: 'Logo', fileName: file.name, sizeBytes: file.size, contentType: file.type }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  vi.mocked(api.post).mockImplementation(async path => path.includes('upload-url')
    ? { ok: true, uploadUrls: [{ id: 'image', url: 'https://upload.test', meta }] } : { ok: true })
  expect(await uploadLibraryImage(file)).toEqual(meta)
  expect(api.put).not.toHaveBeenCalled()
  expect(api.post).toHaveBeenCalledWith('/v1/user/media', { items: [meta] })
  await uploadLogo(file)
  expect(api.put).toHaveBeenCalledWith('/v1/user/media', { kind: 'logo', mediaId: 'image' })
})

it('retains and saves both tab drafts with the same revision and shared appearance', async () => {
  snapshot.formConfig.appearance = { themeMode: 'light', colors: { primary: '#123456', accent: '#654321' } }
  const { rerender } = render(<GameFormSettings gameId="EVENT" section="appearance" />)
  await screen.findByRole('button', { name: '+ QR' })
  expect(screen.queryByLabelText('Vista previa del formulario')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Vista previa del home')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Título del registro')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Momento del cuestionario')).not.toBeInTheDocument()
  expect(screen.queryByText('Aspecto de la partida')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Color principal')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar aspecto' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Recargar formulario' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Home' })).not.toBeInTheDocument()
  expect(api.get).toHaveBeenCalledTimes(2)
  expect(api.put).not.toHaveBeenCalled()
  expect(api.post).not.toHaveBeenCalled()
  rerender(<GameFormSettings gameId="EVENT" section="registration" />)
  fireEvent.change(screen.getByLabelText('Título del registro'), { target: { value: 'Register here' } })
  expect(screen.queryByLabelText('Color principal')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Exportar respuestas' })).not.toBeInTheDocument()
  rerender(<GameFormSettings gameId="EVENT" section="questionnaire" />)
  fireEvent.change(screen.getByLabelText('Título del cuestionario'), { target: { value: 'Your feedback' } })
  expect(screen.queryByLabelText('Color principal')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Vista previa' })).toHaveStyle('--color-primary: #123456')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cuestionario' }))
  await screen.findByText('Cuestionario guardado y confirmado.')
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'EVENT', form: expect.objectContaining({
    expectedRevision: 'r1',
    formConfig: expect.objectContaining({ registrationTitle: 'Register here', quizTitle: 'Your feedback',
      appearance: expect.objectContaining({ colors: expect.objectContaining({ primary: '#123456' }) }) }),
  }) })
  rerender(<GameFormSettings gameId="EVENT" section="registration" />)
  expect(screen.getByLabelText('Título del registro')).toHaveValue('Register here')
  expect(screen.getByRole('button', { name: 'Guardar formulario' })).toBeDisabled()
})
