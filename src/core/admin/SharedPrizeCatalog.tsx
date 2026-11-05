import { useEffect, useState, type ReactNode } from 'react'
import { fetchSharedPrizeCatalog, saveSharedPrizeCatalog, uploadSharedPrizeImage, type SharedPrize } from '../../api/sharedPrizeCatalog'
import { validatePrizeImage } from '../../api/prizeMedia'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import SaveButton from '../ui/SaveButton'

const fieldClass = 'h-9 min-w-0 rounded-lg border border-current/20 bg-surface px-3 text-sm'

type CatalogControls = {
  catalog: SharedPrize[]
  actions: (id: string) => ReactNode
  editor?: { prizeId: string; content: ReactNode }
  busy: boolean
}

export default function SharedPrizeCatalog({ onSaved, children, disabled = false }: {
  onSaved?: () => void
  children: (controls: CatalogControls) => ReactNode
  disabled?: boolean
}) {
  const { t } = useOperatorLanguage()
  const [catalog, setCatalog] = useState<SharedPrize[]>([])
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<SharedPrize | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const creating = !!draft && !catalog.some(prize => prize.id === draft.id)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchSharedPrizeCatalog().then(result => {
      if (cancelled) return
      setCatalog(result.catalog)
      setRevision(result.revision)
    }).catch(() => {
      if (!cancelled) setError(t('No se pudo cargar el catálogo general.', 'Could not load the shared catalog.'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [reload, t])

  const edit = (prize?: SharedPrize) => {
    setError('')
    setMessage('')
    setDraft(prize ? { ...prize } : { id: crypto.randomUUID(), name: '', imageKey: null, imageUrl: null })
  }

  const save = async () => {
    if (!draft || busy) return
    const name = draft.name.trim()
    if (!name) {
      setError(t('Escribe el nombre del premio.', 'Enter a prize name.'))
      return
    }
    if (catalog.some(prize => prize.id !== draft.id && prize.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError(t('Ya existe un premio con ese nombre.', 'A prize with that name already exists.'))
      return
    }
    const next = catalog.some(prize => prize.id === draft.id)
      ? catalog.map(prize => prize.id === draft.id ? { ...draft, name } : prize)
      : [...catalog, { ...draft, name }]
    setBusy(true)
    setError('')
    try {
      const nextRevision = await saveSharedPrizeCatalog(next, revision)
      setCatalog(next)
      setRevision(nextRevision)
      onSaved?.()
      setDraft(null)
      setMessage(t('Premio guardado en el catálogo general.', 'Prize saved to the shared catalog.'))
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      const errorCode = cause instanceof Error && 'code' in cause ? cause.code : undefined
      if (errorCode === 'SharedPrizeCatalogSyncFailed') {
        try {
          const refreshed = await fetchSharedPrizeCatalog()
          setCatalog(refreshed.catalog)
          setRevision(refreshed.revision)
          onSaved?.()
          setDraft(null)
          setMessage(t('Catálogo guardado y cambios aplicados a las partidas existentes.',
            'Catalog saved and changes applied to existing events.'))
        } catch {
          setError(t('El catálogo se guardó, pero no se pudieron actualizar todas las partidas. Recarga para reintentar.',
            'The catalog was saved, but not all events could be updated. Reload to retry.'))
        }
        return
      }
      setError(code.includes('Changed')
        ? t('El catálogo cambió en otra sesión. Recárgalo antes de guardar.', 'The catalog changed in another session. Reload before saving.')
        : t('No se pudo guardar el premio. Reintenta.', 'Could not save the prize. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const next = catalog.filter(prize => prize.id !== id)
      const nextRevision = await saveSharedPrizeCatalog(next, revision)
      setCatalog(next)
      setRevision(nextRevision)
      onSaved?.()
      setMessage(t('Premio eliminado.', 'Prize removed.'))
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code.includes('InUse')
        ? t('No se puede eliminar: está asignado a una o más partidas.', 'Cannot remove this prize while it is assigned to an event.')
        : t('No se pudo eliminar el premio. Reintenta.', 'Could not remove the prize. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const actions = (id: string) => {
    const prize = catalog.find(item => item.id === id)
    return <>
      <button type="button" className="rounded-md px-2 py-1 text-sm underline" disabled={!prize || disabled || busy || !!draft}
        onClick={() => { if (prize) edit(prize) }}>{t('Editar', 'Edit')}</button>
      <button type="button" className="rounded-md px-2 py-1 text-sm text-red-400 underline" disabled={!prize || disabled || busy || !!draft}
        onClick={() => { if (prize) void remove(prize.id) }}>{t('Eliminar', 'Remove')}</button>
    </>
  }

  const editor = draft && <form className="flex flex-wrap items-end gap-2 py-2"
    aria-label={t('Ficha del premio', 'Prize details')}
    onSubmit={event => { event.preventDefault(); void save() }}>
    <label className="min-w-[12rem] flex-1">
      <span className="sr-only">{t('Nombre del premio', 'Prize name')}</span>
      <input autoFocus className={`w-full ${fieldClass}`} value={draft.name} maxLength={120}
        placeholder={t('Nombre del premio', 'Prize name')} disabled={busy}
        onChange={event => setDraft(value => value ? { ...value, name: event.target.value } : value)} />
    </label>
    {draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-9 w-9 object-contain" />}
    <label className={`relative inline-flex cursor-pointer items-center justify-center px-3 ${fieldClass} ${busy ? 'opacity-50' : ''}`}>
      <span>{draft.imageUrl ? t('Cambiar imagen', 'Change image') : t('Añadir imagen PNG', 'Add PNG image')}</span>
      <input className="absolute inset-0 w-full cursor-pointer opacity-0" type="file" accept=".png,image/png"
        aria-label={t('Imagen PNG', 'PNG image')} disabled={busy}
        onChange={async event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          try {
            await validatePrizeImage(file)
            const imageKey = await uploadSharedPrizeImage(file)
            setDraft(value => value ? { ...value, imageKey, imageUrl: URL.createObjectURL(file) } : value)
          } catch {
            setError(t('La imagen debe ser un PNG válido de hasta 5 MB.', 'Image must be a valid PNG no larger than 5 MB.'))
          } finally {
            setBusy(false)
          }
        }} />
    </label>
    <SaveButton type="submit" disabled={busy}>{t('Guardar', 'Save')}</SaveButton>
    <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm"
      disabled={busy} onClick={() => setDraft(null)}>{t('Cancelar', 'Cancel')}</button>
  </form>

  return <section aria-label={t('Catálogo e inventario de premios', 'Prize catalog and inventory')} className="mt-6">
    {loading && <p role="status">{t('Cargando catálogo…', 'Loading catalog…')}</p>}
    {error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3">
      <p>{error}</p>
      {!loading && !draft && <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>
        {t('Recargar', 'Reload')}
      </button>}
    </div>}
    {message && <p role="status" className="mb-3 text-sm text-textSub">{message}</p>}
    {!loading && <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-3">
        <p className="text-sm text-textSub">{t(
          'Premios y stock compartidos por todas las partidas. Gestiona cada ficha, su saldo y su historial desde la misma lista.',
          'Prizes and stock shared across events. Manage each prize, its balance and history from the same list.',
        )}</p>
        <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-sm"
          disabled={disabled || busy || !!draft} onClick={() => edit()}>
          {t('Añadir premio', 'Add prize')}
        </button>
      </div>
      {creating && editor}
      {catalog.length === 0 && !draft && <p className="py-4 text-sm text-textSub">
        {t('Aún no hay premios. Añade una ficha para poder asignarla a las partidas.', 'No prizes yet. Add a prize detail to assign it to events.')}
      </p>}
      {children({ catalog, actions, busy: busy || !!draft,
        editor: draft && !creating ? { prizeId: draft.id, content: editor } : undefined })}
    </>}
  </section>
}
