import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import type { PrizeGameResponse } from '../../api/prizeMedia'
import type { GameDefinition } from '../types'
import type { PrizeCatalog } from '../prizes'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import OperatorPrizeSettings from './OperatorPrizeSettings'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const colors = { primary: '#000', accent: '#000', background: '#000', surface: '#000', textMain: '#fff', textSub: '#fff' }
const definition: GameDefinition = {
  id: 'EMPAREJA2', name: 'EMPAREJA2', colors, GameScreen: () => null, showRanking: true,
}
const initialCatalog: PrizeCatalog = {
  validation: { name: 'Mi premio', limit: 4, imageKey: 'old', imageUrl: 'https://images/old.png' },
  ranking: { name: 'Podium', limit: null, topX: 3 },
  raffle: { name: 'Sorpresa', limit: 2 },
}
let serverResponse: PrizeGameResponse
let decodeFails = false
const binaryFetch = vi.fn()
const revoke = vi.fn()
let urlNumber = 0

beforeEach(() => {
  vi.clearAllMocks()
  urlNumber = 0
  decodeFails = false
  serverResponse = { ok: true, prizeCatalog: structuredClone(initialCatalog) }
  vi.mocked(api.get).mockImplementation(async () => serverResponse)
  vi.mocked(api.post).mockResolvedValue({ ok: true, key: 'uploaded/key', uploadUrl: 'https://upload.test/signed' })
  vi.mocked(api.put).mockImplementation(async (_url, body) => {
    const catalog = (body as { prizeCatalog: PrizeCatalog }).prizeCatalog
    serverResponse = {
      ok: true,
      prizeCatalog: Object.fromEntries(Object.entries(catalog).map(([slot, prize]) => [
        slot, { ...prize, imageUrl: prize.imageKey ? `https://images/${prize.imageKey}.png` : null },
      ])),
    }
    return { ok: true }
  })
  binaryFetch.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', binaryFetch)
  vi.stubGlobal('Image', class {
    naturalWidth = 10
    naturalHeight = 10
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => decodeFails ? this.onerror?.() : this.onload?.())
    }
  })
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return `blob:preview-${++urlNumber}` }
    static revokeObjectURL = revoke
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function png(name = 'prize.png') {
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], name, { type: 'image/png' })
}

async function mount(options: {
  game?: GameDefinition
  plan?: 'free' | 'event'
  settings?: Record<string, unknown>
} = {}) {
  const onPersist = vi.fn()
  const onSavingChange = vi.fn()
  const rendered = render(
    <OperatorLanguageProvider>
      <OperatorLanguageSelector />
      <OperatorPrizeSettings gameId="GAME 1" gameDefinition={options.game ?? definition}
        plan={options.plan ?? 'event'} settings={options.settings ?? {}} onPersist={onPersist}
        onSavingChange={onSavingChange} />
    </OperatorLanguageProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  return { onPersist, onSavingChange, ...rendered }
}

const region = (name = 'Validación / participación') => within(screen.getByRole('region', { name }))
async function selectFile(file = png(), name = 'Validación / participación') {
  fireEvent.change(region(name).getByLabelText(/Imagen PNG/), { target: { files: [file] } })
  await waitFor(() => expect(screen.queryByText('Comprobando PNG...')).not.toBeInTheDocument())
}
async function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByText('Guardado.')
}

describe('prize editor', () => {
  it.each([
    ['EMPAREJA2', true, 'event', ['Validación / participación', 'Ranking', 'Sorteo']],
    ['T1MER', true, 'free', ['Ranking']],
    ['CUPIDO', false, 'free', ['Validación / participación']],
  ] as const)('shows supported slots for %s / %s / %s', async (id, showRanking, plan, names) => {
    await mount({ game: { ...definition, id, showRanking }, plan })
    expect(screen.getAllByRole('region').map(element => element.getAttribute('aria-labelledby')
      && within(element).getByRole('heading').textContent)).toEqual(names)
  })

  it('loads authoritative names and orders name, image, Top X, limit accessibly', async () => {
    await mount({ settings: { prizeValidation: 'stale', maxPrizeValidation: 99 } })
    expect(region().getByLabelText('Premio')).toHaveValue('Mi premio')
    expect(region().getByLabelText('Límite')).toHaveValue('4')
    expect(region('Ranking').getAllByText(/^(Premio|Imagen PNG|Top X|Límite)$/).map(element => element.textContent))
      .toEqual(['Premio', 'Imagen PNG', 'Top X', 'Límite'])
    expect(region().getAllByText(/^(Premio|Imagen PNG|Límite)$/).map(element => element.textContent))
      .toEqual(['Premio', 'Imagen PNG', 'Límite'])
  })

  it('keeps image preview, replacement and removal in one compact row', async () => {
    await mount()
    const preview = region().getByAltText('Vista previa del premio')
    expect(preview).toHaveClass('h-11', 'w-11', 'object-contain')
    expect(preview.parentElement).toHaveClass('flex', 'h-11', 'items-center')
    expect(preview.parentElement).toContainElement(region().getByLabelText(/Imagen PNG/))
    expect(preview.parentElement).toContainElement(region().getByRole('button', { name: 'Quitar imagen' }))
    expect(region().getByText('Cambiar')).toBeInTheDocument()
    expect(region('Ranking').getByText('Elegir PNG')).toBeInTheDocument()
    expect(region().getByText('PNG, máx. 5 MB.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('bg-primary/20', 'border-primary/30', 'hover:bg-primary/30')
    expect(region().getByRole('button', { name: 'Quitar imagen' })).toHaveClass('text-red-400')
  })

  it('treats an empty server catalog as authoritative instead of reviving local names', async () => {
    serverResponse = { ok: true, prizeCatalog: {} }
    await mount({ settings: { prizeValidation: 'stale', maxPrizeValidation: 99 } })
    expect(region().getByLabelText('Premio')).toHaveValue('')
    expect(region().getByLabelText('Límite')).toHaveValue('')
  })

  it('publishes legacy local names and unlimited limits on save', async () => {
    serverResponse = { ok: true, settings: { empareja2: { maxValidations: 7 } } }
    const { onPersist } = await mount({ settings: { prizeValidation: 'Custom Name', prizeTopX: 'Pódium', topX: 5, prizeRaffle: 'Sorteo local' } })
    expect(region().getByLabelText('Límite')).toHaveValue('7')
    await save()
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'GAME 1',
      prizeCatalog: {
        validation: { name: 'Custom Name', limit: 7, imageKey: null },
        ranking: { name: 'Pódium', limit: null, topX: 5, imageKey: null },
        raffle: { name: 'Sorteo local', limit: null, imageKey: null },
      },
    })
    expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({
      prizeValidation: 'Custom Name', maxPrizeValidation: 7, prizeTopX: 'Pódium',
      topX: 5, maxPrizeRanking: undefined, prizeRaffle: 'Sorteo local', maxPrizeRaffle: undefined,
      prizeCatalog: expect.any(Object),
    }))
  })

  it.each(['Validación / participación', 'Ranking', 'Sorteo'])('uploads only when saving %s and strips every signed URL', async name => {
    const { onPersist, onSavingChange } = await mount()
    const file = png()
    await selectFile(file, name)
    expect(region(name).getByAltText('Vista previa del premio')).toHaveAttribute('src', expect.stringContaining('blob:'))
    expect(api.post).not.toHaveBeenCalled()
    expect(binaryFetch).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
    await save()
    const slot = name === 'Ranking' ? 'ranking' : name === 'Sorteo' ? 'raffle' : 'validation'
    expect(api.post).toHaveBeenCalledWith('/v1/game/prizes?action=upload-url', {
      gameId: 'GAME 1', slot, fileName: 'prize.png', contentType: 'image/png', sizeBytes: file.size,
    })
    expect(binaryFetch).toHaveBeenCalledWith('https://upload.test/signed', {
      method: 'PUT', headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'staged=true' }, body: file,
    })
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(binaryFetch.mock.invocationCallOrder[0])
    expect(binaryFetch.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.put).mock.invocationCallOrder[0])
    expect(vi.mocked(api.put).mock.invocationCallOrder[0]).toBeLessThan(onPersist.mock.invocationCallOrder[0])
    const payload = vi.mocked(api.put).mock.calls[0][1] as { prizeCatalog: PrizeCatalog }
    expect(JSON.stringify(payload)).not.toContain('imageUrl')
    expect(payload.prizeCatalog[slot]?.imageKey).toBe('uploaded/key')
    expect(onSavingChange.mock.calls).toEqual([[true], [false]])
    expect(region(name).getByAltText('Vista previa del premio')).toHaveAttribute('src', 'https://images/uploaded/key.png')
    expect(revoke).toHaveBeenCalled()
  })

  it.each([
    ['wrong extension', () => new File(['x'], 'prize.jpg', { type: 'image/png' }), 'Selecciona'],
    ['wrong MIME', () => new File(['x'], 'prize.png', { type: 'image/jpeg' }), 'Selecciona'],
    ['too large', () => new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'prize.png', { type: 'image/png' }), '5 MB'],
    ['false signature', () => new File(['fake'], 'prize.png', { type: 'image/png' }), 'no es una imagen PNG válida'],
  ])('rejects %s locally with an accessible error', async (_label, file, message) => {
    await mount()
    await selectFile((file as () => File)())
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    expect(region().getByLabelText(/Imagen PNG/)).toHaveAttribute('aria-invalid', 'true')
    expect(region().getByAltText('Vista previa del premio')).toHaveAttribute('src', 'https://images/old.png')
    expect(api.post).not.toHaveBeenCalled()
    expect(binaryFetch).not.toHaveBeenCalled()
  })

  it('rejects a signed but undecodable PNG and revokes its decoding URL', async () => {
    await mount()
    decodeFails = true
    await selectFile()
    expect(await screen.findByRole('alert')).toHaveTextContent('no se puede decodificar')
    expect(revoke).toHaveBeenCalled()
    expect(binaryFetch).not.toHaveBeenCalled()
  })

  it('keeps an independent file draft for every slot', async () => {
    await mount()
    await selectFile(png('validation.png'))
    await selectFile(png('ranking.png'), 'Ranking')
    await selectFile(png('raffle.png'), 'Sorteo')
    expect(screen.getAllByAltText('Vista previa del premio')).toHaveLength(3)
    await save()
    expect(vi.mocked(api.post).mock.calls.map(call => (call[1] as { fileName: string }).fileName))
      .toEqual(['validation.png', 'ranking.png', 'raffle.png'])
    expect(api.put).toHaveBeenCalledOnce()
  })

  it('replaces and removes only the image draft until save, cleaning object URLs', async () => {
    const { onPersist, unmount } = await mount()
    await selectFile(png('first.png'))
    const firstUrl = region().getByAltText('Vista previa del premio').getAttribute('src')
    await selectFile(png('replacement.png'))
    expect(revoke).toHaveBeenCalledWith(firstUrl)
    const secondUrl = region().getByAltText('Vista previa del premio').getAttribute('src')
    fireEvent.click(region().getByRole('button', { name: 'Quitar imagen' }))
    expect(revoke).toHaveBeenCalledWith(secondUrl)
    expect(region().queryByAltText('Vista previa del premio')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
    await save()
    expect((vi.mocked(api.put).mock.calls[0][1] as { prizeCatalog: PrizeCatalog }).prizeCatalog.validation?.imageKey).toBeNull()
    expect(serverResponse.prizeCatalog?.validation).toMatchObject({ imageKey: null, imageUrl: null })
    expect(region().queryByAltText('Vista previa del premio')).not.toBeInTheDocument()
    expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({
      prizeCatalog: expect.objectContaining({
        validation: expect.objectContaining({ imageKey: null, imageUrl: null }),
      }),
    }))
    expect(api.post).not.toHaveBeenCalled()
    await selectFile()
    const lastUrl = region().getByAltText('Vista previa del premio').getAttribute('src')
    unmount()
    expect(revoke).toHaveBeenCalledWith(lastUrl)
  })

  it.each(['upload', 'save'])('keeps pending file, name and limit on %s failure without persisting cache', async failure => {
    const { onPersist } = await mount()
    fireEvent.change(region().getByLabelText('Premio'), { target: { value: 'Never translate me' } })
    fireEvent.change(region().getByLabelText('Límite'), { target: { value: '8' } })
    await selectFile()
    const preview = region().getByAltText('Vista previa del premio').getAttribute('src')
    if (failure === 'upload') binaryFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    else vi.mocked(api.put).mockRejectedValueOnce(new Error('Offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se han guardado')
    expect(onPersist).not.toHaveBeenCalled()
    expect(region().getByLabelText('Premio')).toHaveValue('Never translate me')
    expect(region().getByLabelText('Límite')).toHaveValue('8')
    expect(region().getByAltText('Vista previa del premio')).toHaveAttribute('src', preview)
    await save()
    expect(api.post).toHaveBeenCalledTimes(2)
    expect(onPersist).toHaveBeenCalledOnce()
  })

  it('does not perform binary upload or persist cache when the authenticated upload URL request fails', async () => {
    const { onPersist } = await mount()
    await selectFile()
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Not authorized'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized')
    expect(binaryFetch).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
    expect(region().getByAltText('Vista previa del premio')).toHaveAttribute('src', expect.stringContaining('blob:'))
  })

  it('preserves hidden catalog slots but does not introduce unsupported ones', async () => {
    await mount({ game: { ...definition, id: 'T1MER' }, plan: 'free' })
    fireEvent.change(region('Ranking').getByLabelText('Premio'), { target: { value: 'New podium' } })
    await save()
    expect((vi.mocked(api.put).mock.calls[0][1] as { prizeCatalog: PrizeCatalog }).prizeCatalog).toEqual({
      validation: { name: 'Mi premio', limit: 4, imageKey: 'old' },
      ranking: { name: 'New podium', limit: null, topX: 3, imageKey: null },
      raffle: { name: 'Sorpresa', limit: 2 },
    })
  })

  it('does not publish legacy slots that are unavailable for the current game and plan', async () => {
    serverResponse = { ok: true }
    await mount({
      game: { ...definition, id: 'T1MER' }, plan: 'free',
      settings: { prizeValidation: 'Unavailable validation', prizeRaffle: 'Unavailable raffle', prizeTopX: 'Ranking only' },
    })
    await save()
    expect((vi.mocked(api.put).mock.calls[0][1] as { prizeCatalog: PrizeCatalog }).prizeCatalog).toEqual({
      ranking: { name: 'Ranking only', limit: null, topX: 3, imageKey: null },
    })
  })

  it.each(['-1', '1.5', 'nonsense', '1e2'])('visibly rejects invalid limit %s instead of coercing it', async value => {
    const { onPersist } = await mount()
    fireEvent.change(region().getByLabelText('Límite'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El límite debe ser un entero')
    expect(region().getByLabelText('Límite')).toHaveValue(value)
    expect(api.put).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('rejects out-of-range Top X without clamping', async () => {
    await mount()
    fireEvent.change(region('Ranking').getByLabelText('Top X'), { target: { value: '101' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Top X')
    expect(region('Ranking').getByLabelText('Top X')).toHaveValue('101')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('disables edits, signals close guard and suppresses duplicate saves while uploading', async () => {
    let finishUpload!: (result: { ok: boolean }) => void
    binaryFetch.mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve }))
    const { onPersist, onSavingChange } = await mount()
    await selectFile()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(binaryFetch).toHaveBeenCalledOnce())
    const saving = screen.getByRole('button', { name: 'Guardando...' })
    expect(saving).toBeDisabled()
    expect(region().getByLabelText('Premio')).toBeDisabled()
    expect(region().getByLabelText(/Imagen PNG/)).toBeDisabled()
    fireEvent.click(saving)
    expect(api.post).toHaveBeenCalledOnce()
    expect(onSavingChange).toHaveBeenCalledWith(true)
    expect(onPersist).not.toHaveBeenCalled()
    await act(async () => finishUpload({ ok: true }))
    await screen.findByText('Guardado.')
    expect(onPersist).toHaveBeenCalledOnce()
    expect(onSavingChange).toHaveBeenLastCalledWith(false)
  })

  it('reports confirmed success, keeps the preview and callback when the post-save refresh fails', async () => {
    const { onPersist } = await mount()
    await selectFile()
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Refresh offline'))
    await save()
    expect(screen.getByText(/Los premios se guardaron en el servidor/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onPersist).toHaveBeenCalledOnce()
    expect(onPersist.mock.calls[0][0]).not.toHaveProperty('prizeCatalog')
    expect(JSON.stringify(onPersist.mock.calls[0][0])).not.toContain('blob:')
    expect(JSON.stringify(onPersist.mock.calls[0][0])).not.toContain('uploaded/key')
    expect(region().getByAltText('Vista previa del premio')).toHaveAttribute('src', expect.stringContaining('blob:'))
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(api.post).toHaveBeenCalledOnce()
  })

  it('publishes only the authoritative committed key returned after saving a staged upload', async () => {
    const { onPersist } = await mount()
    await selectFile()
    vi.mocked(api.get).mockResolvedValueOnce({
      ok: true,
      prizeCatalog: {
        ...initialCatalog,
        validation: { name: 'Mi premio', limit: 4, imageKey: 'committed/key', imageUrl: 'https://images/committed.png' },
      },
    })
    await save()
    expect((vi.mocked(api.put).mock.calls[0][1] as { prizeCatalog: PrizeCatalog }).prizeCatalog.validation?.imageKey).toBe('uploaded/key')
    expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({
      prizeCatalog: expect.objectContaining({
        validation: expect.objectContaining({ imageKey: 'committed/key', imageUrl: 'https://images/committed.png' }),
      }),
    }))
  })

  it('explains confirmed server success even if the local persistence callback fails', async () => {
    const { onPersist } = await mount()
    onPersist.mockImplementationOnce(() => { throw new Error('Storage full') })
    await save()
    expect(screen.getByText(/no se pudo actualizar la caché local/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(api.put).toHaveBeenCalledOnce()
  })

  it('switches ES/EN without losing names, image draft, numeric values or reloading', async () => {
    await mount()
    fireEvent.change(region().getByLabelText('Premio'), { target: { value: 'Mi nombre personalizado' } })
    fireEvent.change(region().getByLabelText('Límite'), { target: { value: '12' } })
    await selectFile()
    const preview = region().getByAltText('Vista previa del premio').getAttribute('src')
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    const english = region('Validation / participation')
    expect(english.getByLabelText('Prize')).toHaveValue('Mi nombre personalizado')
    expect(english.getByLabelText('Limit')).toHaveValue('12')
    expect(english.getByAltText('Prize preview')).toHaveAttribute('src', preview)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(api.get).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
    expect(region().getByLabelText('Premio')).toHaveValue('Mi nombre personalizado')
  })

  it('keeps numeric and file errors accessible and translated when switching ES/EN', async () => {
    await mount()
    await selectFile(new File(['fake'], 'fake.png', { type: 'image/png' }))
    fireEvent.change(region().getByLabelText('Límite'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    const english = region('Validation / participation')
    expect(english.getByLabelText(/PNG image/)).toHaveAttribute('aria-invalid', 'true')
    expect(english.getByLabelText('Limit')).toHaveAttribute('aria-invalid', 'true')
    expect(english.getByLabelText('Limit')).toHaveValue('-1')
    expect(english.getByText(/not a valid PNG/)).toHaveAttribute('role', 'alert')
    expect(english.getByText(/Limit must be a whole number/)).toHaveAttribute('role', 'alert')
    expect(english.getByAltText('Prize preview')).toHaveAttribute('src', 'https://images/old.png')
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
    expect(region().getByText(/no es una imagen PNG válida/)).toHaveAttribute('role', 'alert')
    expect(region().getByText(/El límite debe ser un entero/)).toHaveAttribute('role', 'alert')
  })

  it('gives each native file input a unique translated accessible label and linked label element', async () => {
    await mount()
    for (const slot of ['Validación / participación', 'Ranking', 'Sorteo']) {
      const input = screen.getByLabelText(`${slot}: Imagen PNG`)
      expect(input).toHaveAttribute('type', 'file')
      expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent('Imagen PNG')
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    for (const slot of ['Validation / participation', 'Ranking', 'Raffle']) {
      expect(screen.getByLabelText(`${slot}: PNG image`)).toHaveAttribute('type', 'file')
    }
  })

  it('blocks saving after load failure and offers retry without publishing local defaults', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'))
    const onPersist = vi.fn()
    render(<OperatorPrizeSettings gameId="X" gameDefinition={definition} plan="event" settings={{ prizeValidation: 'local' }} onPersist={onPersist} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
    expect(region().getByLabelText('Premio')).toHaveValue('Mi premio')
    expect(onPersist).not.toHaveBeenCalled()
  })
})
