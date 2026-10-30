import { useEffect, useRef, useState } from 'react'
import { stackPrizeApi, type StackPrizeCondition, type StackPrizeItem, type StackPrizeProgram, type StackPrizeRule, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi, type KivlyReward, type KivlyRewardDraft } from '../../api/kivlyApi'
import { PrizeImageError, uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import { useOperatorLanguage } from '../shell/operatorLanguage'

const field = 'rounded-xl border border-white/15 bg-surface px-3 py-2 text-sm min-w-0'
const selectField = 'stack-prize-select rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm min-w-0'
const action = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-40'
const conditions: StackPrizeCondition[] = ['completed', 'top_finish', 'top_final', 'raffle']
const newId = () => crypto.randomUUID()

type KivlyRewardForm = {
  title: string
  description: string
  rewardType: KivlyRewardDraft['rewardType']
  value: string
  pointsRequired: string
  termsAndConditions: string
  validFrom: string
  validUntil: string
  maxRedemptions: string
  maxRedemptionsPerUser: string
}

const emptyKivlyRewardForm: KivlyRewardForm = {
  title: '', description: '', rewardType: 'discount_percentage', value: '',
  pointsRequired: '0', termsAndConditions: '', validFrom: '',
  validUntil: '', maxRedemptions: '', maxRedemptionsPerUser: '',
}

function isUncertainRewardCreation(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === 'KivlyRewardCreationUncertain') return true
  return 'isNetworkError' in error && error.isNetworkError === true
}

export default function StackPrizeSettings({ gameId, raffles, onPersist, onSavingChange }: {
  gameId: string
  raffles: boolean
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const text = useRef(t)
  text.current = t
  const [data, setData] = useState<StackPrizeSettingsResponse | null>(null)
  const [program, setProgram] = useState<StackPrizeProgram | null>(null)
  const [rewards, setRewards] = useState<KivlyReward[]>([])
  const [locationId, setLocationId] = useState<string | null>(null)
  const [kivlyConnected, setKivlyConnected] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [rewardForm, setRewardForm] = useState<KivlyRewardForm>(emptyKivlyRewardForm)
  const [rewardError, setRewardError] = useState('')
  const [rewardMessage, setRewardMessage] = useState('')
  const [rewardCreationUncertain, setRewardCreationUncertain] = useState(false)
  const [rewardImage, setRewardImage] = useState<File | null>(null)
  const [rewardImagePreview, setRewardImagePreview] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createSource, setCreateSource] = useState<'stand' | 'kivly'>('stand')
  const [initialStock, setInitialStock] = useState({ stand: 100, kivly: 100 })
  const [standImage, setStandImage] = useState<File | null>(null)
  const [standImagePreview, setStandImagePreview] = useState('')
  const [validatingImage, setValidatingImage] = useState(false)
  const [search, setSearch] = useState('')
  const [activeImageActions, setActiveImageActions] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [name, setName] = useState('')
  const [dirty, setDirty] = useState(false)
  const previews = useRef(new Map<string, string>())
  const catalogScroller = useRef<HTMLDivElement | null>(null)
  const uncertainRewardTitle = useRef<string | null>(null)
  useEffect(() => () => {
    previews.current.forEach((url) => URL.revokeObjectURL(url))
    previews.current.clear()
  }, [gameId])
  useEffect(() => () => {
    if (rewardImagePreview) URL.revokeObjectURL(rewardImagePreview)
  }, [rewardImagePreview])
  useEffect(() => () => {
    if (standImagePreview) URL.revokeObjectURL(standImagePreview)
  }, [standImagePreview])
  const label = (condition: StackPrizeCondition) => ({
    completed: t('complete una partida', 'a player completes a game'),
    top_finish: t('entre en el top al terminar su partida', 'a player finishes in the top'),
    top_final: t('esté en el top al cerrar el juego', 'a player is in the top when the game closes'),
    raffle: t('gane un sorteo', 'a player wins a raffle'),
  })[condition]
  useEffect(() => {
    let cancelled = false
    setData(null)
    setProgram(null)
    setError('')
    setDirty(false)
    void stackPrizeApi.get(gameId).then((response) => {
      if (cancelled) return
      if (response.ok !== true || response.program?.version !== 3) throw new Error('Invalid prize configuration')
      setData(response)
      setProgram(response.program)
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : text.current('No se pudieron cargar los premios.', 'Could not load prizes.'))
    })
    return () => { cancelled = true }
  }, [gameId, revision])
  useEffect(() => {
    let cancelled = false
    setRewards([])
    setLocationId(null)
    setKivlyConnected(false)
    setCatalogError('')
    void kivlyApi.getAccountConnection().then(async (connection) => {
      if (cancelled) return
      setKivlyConnected(connection.connected)
      if (!connection.connected) return
      setLocationId(connection.locationId)
      const catalog = await kivlyApi.listRewards(gameId)
      if (!cancelled) {
        setRewards(catalog)
        const pendingTitle = uncertainRewardTitle.current
        if (pendingTitle !== null) {
          const found = catalog.some((reward) => reward.name.trim().toLocaleLowerCase()
            === pendingTitle.trim().toLocaleLowerCase())
          if (!found) {
            uncertainRewardTitle.current = null
            setRewardCreationUncertain(false)
            setRewardError('')
            setRewardMessage(text.current(
              'No se encontró un premio con ese nombre. Ya puedes volver a intentar.',
              'No reward with that name was found. You can try again now.',
            ))
          } else {
            setRewardMessage(text.current(
              'Ya hay un premio con ese nombre en Kivly. No se enviará otro para evitar duplicados.',
              'A reward with that name is already in Kivly. Another will not be sent to avoid duplicates.',
            ))
          }
        }
      }
    }).catch(() => {
      if (!cancelled) setCatalogError(text.current('No se pudo cargar Kivly. Comprueba la conexión antes de guardar sus premios.',
        'Could not load Kivly. Check the connection before saving its rewards.'))
    })
    return () => { cancelled = true }
  }, [gameId, catalogRevision])

  useEffect(() => {
    setRewards([])
    setLocationId(null)
    setKivlyConnected(false)
    setCatalogError('')
    setRewardForm(emptyKivlyRewardForm)
    setRewardImage(null)
    setRewardImagePreview('')
    setStandImage(null)
    setStandImagePreview('')
    setCreateOpen(false)
    setInitialStock({ stand: 100, kivly: 100 })
    setSearch('')
    setRewardError('')
    setRewardMessage('')
    setRewardCreationUncertain(false)
    uncertainRewardTitle.current = null
  }, [gameId])

  const change = (next: StackPrizeProgram) => { setProgram(next); setDirty(true); setMessage('') }
  const updateRewardForm = (patch: Partial<KivlyRewardForm>) => {
    setRewardForm((previous) => ({ ...previous, ...patch }))
    setRewardError('')
    setRewardMessage('')
  }
  const updateDraftImage = async (file: File, source: 'stand' | 'kivly') => {
    setValidatingImage(true)
    try {
      await validatePrizeImage(file)
      const preview = URL.createObjectURL(file)
      if (source === 'stand') {
        setStandImage(file)
        setStandImagePreview(preview)
      } else {
        setRewardImage(file)
        setRewardImagePreview(preview)
      }
      setRewardError('')
    } catch (cause) {
      setRewardError(cause instanceof PrizeImageError
        ? t('Selecciona una imagen PNG válida de como máximo 5 MB.', 'Choose a valid PNG image no larger than 5 MB.')
        : cause instanceof Error ? cause.message : t('No se pudo leer la imagen.', 'Could not read the image.'))
    } finally {
      setValidatingImage(false)
    }
  }
  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true); onSavingChange?.(true); setError(''); setMessage('')
    try { await work() } catch (cause) {
      setError(cause instanceof PrizeImageError
        ? t('Selecciona una imagen PNG válida de como máximo 5 MB.', 'Choose a valid PNG image no larger than 5 MB.')
        : cause instanceof Error ? cause.message : t('No se pudo guardar.', 'Could not save.'))
    } finally { setBusy(false); onSavingChange?.(false) }
  }
  const save = () => run(async () => {
    if (!program) return
    const saved = await stackPrizeApi.save(gameId, program)
    setProgram(saved)
    setDirty(false)
    setData((previous) => previous ? {
      ...previous, program: saved, enabled: true,
      inventory: saved.catalog.map((prize) => {
        const old = previous.inventory.find((item) => item.prizeId === prize.id)
        const consumed = old ? Math.max(0, old.total - old.remaining) : 0
        return { prizeId: prize.id, total: prize.stockTotal, remaining: Math.max(0, prize.stockTotal - consumed) }
      }),
    } : previous)
    onPersist({ stackPrizeProgram: saved, prizeCatalog: {} })
    setMessage(t('Premios guardados. Los premios ya ganados se conservan.', 'Prizes saved. Previously earned prizes are preserved.'))
  })
  const chooseImage = (prize: StackPrizeItem, file: File) => run(async () => {
    if (!program) return
    const configured = program.catalog.some((item) => item.id === prize.id)
    if (!configured && program.catalog.length >= 32) throw new Error(t('El catálogo admite hasta 32 premios.', 'The catalog supports up to 32 prizes.'))
    await validatePrizeImage(file)
    const imageKey = await uploadPrizeImage(gameId, 'ranking', file)
    const oldPreview = previews.current.get(prize.id)
    if (oldPreview) URL.revokeObjectURL(oldPreview)
    const imageUrl = URL.createObjectURL(file)
    const id = configured ? prize.id : newId()
    previews.current.set(id, imageUrl)
    change({ ...program, catalog: configured
      ? program.catalog.map((item) => item.id === prize.id ? { ...item, imageKey, imageUrl } : item)
      : [...program.catalog, { ...prize, id, imageKey, imageUrl }] })
    setMessage(t('Imagen preparada; guarda para aplicarla.', 'Image ready; save to apply it.'))
  })
  const createKivlyReward = async () => {
    if (busy || !Number.isInteger(initialStock.kivly) || initialStock.kivly < 1 || initialStock.kivly > 1000
      || !program || program.catalog.length >= 32 || !kivlyConnected || !locationId
      || data?.state !== 'open' || rewardCreationUncertain) return
    const value = Number(rewardForm.value)
    const pointsRequired = Number(rewardForm.pointsRequired)
    if (!rewardForm.title.trim() || !rewardForm.description.trim()
      || !rewardForm.value.trim() || !Number.isFinite(value)
      || !Number.isInteger(pointsRequired) || pointsRequired < 0) {
      setRewardError(t('Completa nombre, descripción, valor y puntos válidos.',
        'Enter a name, description, value, and valid points threshold.'))
      return
    }

    const dateToIso = (value: string) => {
      if (!value) return undefined
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date.toISOString()
    }
    const validFrom = dateToIso(rewardForm.validFrom)
    const validUntil = dateToIso(rewardForm.validUntil)
    if (validFrom === null || validUntil === null
      || (validFrom && validUntil && new Date(validFrom) > new Date(validUntil))) {
      setRewardError(t('Revisa las fechas de vigencia.', 'Check the reward validity dates.'))
      return
    }
    const maxRedemptions = rewardForm.maxRedemptions.trim()
      ? Number(rewardForm.maxRedemptions) : undefined
    const maxRedemptionsPerUser = rewardForm.maxRedemptionsPerUser.trim()
      ? Number(rewardForm.maxRedemptionsPerUser) : undefined
    if ((maxRedemptions !== undefined && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1))
      || (maxRedemptionsPerUser !== undefined
        && (!Number.isInteger(maxRedemptionsPerUser) || maxRedemptionsPerUser < 1))) {
      setRewardError(t('Los límites deben ser números enteros mayores que cero.',
        'Redemption limits must be whole numbers greater than zero.'))
      return
    }

    const draft: KivlyRewardDraft = {
      title: rewardForm.title.trim(),
      description: rewardForm.description.trim(),
      rewardType: rewardForm.rewardType,
      value,
      pointsRequired,
      ...(rewardForm.termsAndConditions.trim()
        ? { termsAndConditions: rewardForm.termsAndConditions.trim() } : {}),
      ...(validFrom ? { validFrom } : {}),
      ...(validUntil ? { validUntil } : {}),
      ...(maxRedemptions !== undefined ? { maxRedemptions } : {}),
      ...(maxRedemptionsPerUser !== undefined ? { maxRedemptionsPerUser } : {}),
    }
    setBusy(true)
    onSavingChange?.(true)
    setRewardError('')
    setRewardMessage('')
    let creationRequested = false
    try {
      const imageKey = rewardImage ? await uploadPrizeImage(gameId, 'ranking', rewardImage) : undefined
      creationRequested = true
      const reward = await kivlyApi.createReward(gameId, draft)
      const id = newId()
      const imageUrl = rewardImage ? URL.createObjectURL(rewardImage) : reward.imageUrl
      if (rewardImage && imageUrl) previews.current.set(id, imageUrl)
      change({ ...program, catalog: [...program.catalog, {
        id, source: 'kivly', rewardId: reward.id, locationId, name: reward.name,
        stockTotal: initialStock.kivly, ...(imageKey ? { imageKey } : {}), imageUrl,
      }] })
      setRewardForm(emptyKivlyRewardForm)
      setRewardImage(null)
      setRewardImagePreview('')
      setInitialStock((previous) => ({ ...previous, kivly: 100 }))
      setCreateOpen(false)
      uncertainRewardTitle.current = null
      setRewardCreationUncertain(false)
      setMessage(t('Premio creado en Kivly. Guarda para aplicar el inventario y la imagen al juego.',
        'Reward created in Kivly. Save to apply stock and the image to the game.'))
      setCatalogRevision((revision) => revision + 1)
    } catch (cause) {
      if (creationRequested && isUncertainRewardCreation(cause)) {
        uncertainRewardTitle.current = draft.title
        setRewardCreationUncertain(true)
        setRewardError(t('No se pudo confirmar la creación. Actualiza el catálogo antes de volver a enviarla.',
          'Creation could not be confirmed. Refresh the catalog before submitting again.'))
      } else {
        const code = typeof cause === 'object' && cause !== null && 'code' in cause
          && typeof cause.code === 'string' ? cause.code : ''
        const codeMessages: Record<string, string> = {
          KivlyWritesDisabled: t('La creación de premios Kivly está deshabilitada en este entorno.',
            'Kivly reward creation is disabled in this environment.'),
          KivlyAccessDenied: t('La conexión de Kivly no tiene permiso para crear premios.',
            'The Kivly connection is not authorized to create rewards.'),
          KivlyConnectionRequired: t('Conecta Kivly antes de crear un premio.',
            'Connect Kivly before creating a reward.'),
          KivlyRateLimited: t('Kivly ha limitado las solicitudes. Espera antes de volver a intentarlo.',
            'Kivly is rate limiting requests. Wait before trying again.'),
          KivlyValidationFailed: t('Kivly no aceptó estos datos. Revisa los campos del premio.',
            'Kivly rejected these details. Review the reward fields.'),
        }
        const codeMessage = codeMessages[code]
        setRewardError(codeMessage ?? (cause instanceof Error ? cause.message
          : t('No se pudo crear el premio.', 'Could not create the reward.')))
      }
    } finally {
      setBusy(false)
      onSavingChange?.(false)
    }
  }
  if (!program || !data) return <div className="space-y-3">
    {error ? <p role="alert" className="text-red-300">{error}</p> : <p role="status">{t('Cargando premios...', 'Loading prizes...')}</p>}
    {error && <button className={action} onClick={() => setRevision((value) => value + 1)}>{t('Reintentar', 'Retry')}</button>}
  </div>
  const editable = data.state === 'open'
  const available = [...program.catalog, ...rewards.filter((reward) => !program.catalog.some((prize) =>
    prize.source === 'kivly' && prize.rewardId === reward.id && prize.locationId === locationId)).map((reward): StackPrizeItem => ({
      id: `kivly_${reward.id}`, source: 'kivly', rewardId: reward.id, name: reward.name,
      locationId: locationId ?? '', stockTotal: 100, imageUrl: reward.imageUrl,
    }))]
  const parsedRewardValue = Number(rewardForm.value)
  const parsedPointsRequired = Number(rewardForm.pointsRequired)
  const canCreateReward = rewardForm.title.trim().length > 0
    && rewardForm.description.trim().length > 0 && rewardForm.value.trim().length > 0
    && Number.isFinite(parsedRewardValue)
    && Number.isInteger(parsedPointsRequired) && parsedPointsRequired >= 0
  const invalidProgram = program.catalog.some((prize) => {
    const stock = data.inventory.find((item) => item.prizeId === prize.id)
    const allocated = stock ? stock.total - stock.remaining : 0
    return !Number.isInteger(prize.stockTotal) || prize.stockTotal < Math.max(1, allocated) || prize.stockTotal > 1000
  }) || program.rules.some((rule) => rule.groups.length === 0 || rule.groups.some((group) =>
    group.allocations.length === 0 || group.allocations.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10))
    || (rule.condition.startsWith('top_') && (!Number.isInteger(rule.topX) || (rule.topX ?? 0) < 1 || (rule.topX ?? 101) > 100)))
  const updateRule = (index: number, rule: StackPrizeRule) => change({
    ...program, rules: program.rules.map((previous, i) => i === index ? { ...rule, id: newId() } : previous),
  })
  const addPrize = (ruleIndex: number, groupIndex: number, id: string) => {
    const selected = available.find((item) => item.id === id)
    if (!selected) return
    const existing = program.catalog.some((item) => item.id === id)
    if (!existing && program.catalog.length >= 32) return
    const prize = existing ? selected : { ...selected, id: newId() }
    change({
      ...program, catalog: existing ? program.catalog : [...program.catalog, prize],
      rules: program.rules.map((rule, index) => index === ruleIndex ? { ...rule, id: newId(),
        groups: rule.groups.map((group, i) => i === groupIndex
          ? { allocations: [...group.allocations, { prizeId: prize.id, quantity: 1 }] } : group),
      } : rule),
    })
  }
  const createStandPrize = () => run(async () => {
    if (!program || !name.trim() || program.catalog.length >= 32
      || !Number.isInteger(initialStock.stand) || initialStock.stand < 1 || initialStock.stand > 1000) return
    const id = newId()
    let imageKey: string | null = null
    if (standImage) imageKey = await uploadPrizeImage(gameId, 'ranking', standImage)
    const imageUrl = standImage ? URL.createObjectURL(standImage) : null
    if (imageUrl) previews.current.set(id, imageUrl)
    change({
      ...program,
      catalog: [...program.catalog, {
        id, source: 'stand', name: name.trim(), limit: null, stockTotal: initialStock.stand,
        imageKey, imageUrl,
      }],
    })
    setName('')
    setStandImage(null)
    setStandImagePreview('')
    setInitialStock((previous) => ({ ...previous, stand: 100 }))
    setCreateOpen(false)
  })
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredPrizes = available.filter((prize) =>
    prize.name.toLocaleLowerCase().includes(normalizedSearch))
  const validInitialStock = Number.isInteger(initialStock[createSource])
    && initialStock[createSource] >= 1 && initialStock[createSource] <= 1000
  const emailStates = {
    pending: t('Pendiente de envío', 'Waiting to send'),
    sending: t('Enviando', 'Sending'),
    accepted: t('Aceptado por el proveedor de email; entrega no confirmada', 'Accepted by email provider; delivery not confirmed'),
    failed: t('Error de envío', 'Sending failed'),
    reconciliation_required: t('Envío incierto: comprobar antes de reenviar', 'Uncertain send: check before resending'),
  }
  return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 pb-4">
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    {catalogError && <div role="alert" className="text-sm text-amber-300">{catalogError}
      <button type="button" className="ml-2 underline" disabled={busy} onClick={() => setCatalogRevision((value) => value + 1)}>{t('Reintentar', 'Retry')}</button>
    </div>}
    {!editable && <p role="status" className="text-sm text-textSub">{t('El juego se está cerrando o está cerrado. Los premios no se pueden editar.',
      'The game is closing or closed. Prizes cannot be edited.')}</p>}
    <fieldset disabled={busy || validatingImage || !editable} className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{t('Catálogo de premios', 'Prize catalog')}</h3>
            <p className="text-xs text-textSub">{t('Busca, crea y gestiona el inventario disponible.', 'Search, create, and manage available stock.')}</p>
          </div>
          <button type="button" className={`${action} font-semibold`} aria-expanded={createOpen}
            onClick={() => setCreateOpen((open) => !open)}>
            {createOpen ? t('Cerrar', 'Close') : t('+ CREAR', '+ CREATE')}
          </button>
        </div>
        {createOpen && <section aria-label={t('Crear premio', 'Create prize')}
          className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 [&_input:not([type=file])]:h-8 [&_input]:px-2 [&_input]:py-1 [&_input]:text-xs [&_select]:h-8 [&_select]:px-2 [&_select]:py-1 [&_select]:text-xs [&_textarea]:px-2 [&_textarea]:py-1 [&_textarea]:text-xs">
          {rewardError && <p role="alert" className="text-xs text-red-300">{rewardError}</p>}
          <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-4">
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Origen del premio', 'Prize source')}</span>
              <select className={`${selectField} w-full`} value={createSource}
                onChange={(event) => setCreateSource(event.target.value as 'stand' | 'kivly')}>
                <option value="stand">STAND</option>
                <option value="kivly" disabled={!kivlyConnected || !locationId}>Kivly</option>
              </select>
            </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Nombre', 'Name')}</span>
                <input aria-label={createSource === 'stand' ? t('Nombre del premio STAND', 'STAND prize name') : t('Nombre', 'Name')}
                  value={createSource === 'stand' ? name : rewardForm.title} maxLength={200}
                  onChange={(event) => createSource === 'stand' ? setName(event.target.value) : updateRewardForm({ title: event.target.value })} className={`${field} w-full`}
                  placeholder={t('Nombre del nuevo premio', 'New prize name')} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Stock inicial', 'Initial stock')}</span>
                <input type="number" min={1} max={1000} step={1} className={`${field} w-full`}
                  value={Number.isFinite(initialStock[createSource]) ? initialStock[createSource] : ''}
                  onChange={(event) => setInitialStock({ ...initialStock, [createSource]: event.target.valueAsNumber })} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Imagen PNG', 'PNG image')}</span>
                <span className="flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/25 px-2 text-xs hover:border-primary/60">
                  {(createSource === 'stand' ? standImagePreview : rewardImagePreview) && <img
                    src={createSource === 'stand' ? standImagePreview : rewardImagePreview}
                    alt={t('Vista previa del nuevo premio', 'New prize preview')} className="h-6 w-6 shrink-0 object-contain" />}
                  <span className="truncate">{(createSource === 'stand' ? standImage : rewardImage)?.name ?? t('Subir imagen', 'Upload image')}</span>
                  <input type="file" accept="image/png" className="sr-only"
                    aria-label={createSource === 'stand' ? t('Imagen del nuevo premio STAND', 'New STAND prize image') : t('Imagen del nuevo premio Kivly', 'New Kivly reward image')}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void updateDraftImage(file, createSource)
                    }} />
                </span>
              </label>
            </div>
          {!validInitialStock && <p role="alert" className="text-xs text-red-300">{t('El stock debe ser un entero entre 1 y 1000.', 'Stock must be a whole number between 1 and 1000.')}</p>}
          {createSource === 'stand' ? <>
            <button type="button" className={`${action} py-1 text-xs`} disabled={!name.trim() || !validInitialStock || program.catalog.length >= 32}
              onClick={() => void createStandPrize()}>{t('Crear premio STAND', 'Create STAND prize')}</button>
          </> : <>
          {rewardMessage && <p role="status" className="text-xs text-textSub">{rewardMessage}</p>}
          {rewardCreationUncertain && <button type="button" className={action} disabled={busy}
            onClick={() => setCatalogRevision((revision) => revision + 1)}>
            {t('Actualizar catálogo y revisar', 'Refresh catalog and review')}
          </button>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Tipo de premio', 'Reward type')}</span>
              <select className={`${selectField} w-full`} value={rewardForm.rewardType}
                onChange={(event) => updateRewardForm({
                  rewardType: event.target.value as KivlyRewardDraft['rewardType'],
                })}>
                <option value="discount_percentage">{t('Descuento porcentual', 'Percentage discount')}</option>
                <option value="discount_fixed">{t('Descuento fijo', 'Fixed discount')}</option>
                <option value="free_item">{t('Producto gratis', 'Free item')}</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Valor', 'Value')}</span>
              <input className={`${field} w-full`} type="number" step="any" value={rewardForm.value}
                onChange={(event) => updateRewardForm({ value: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Puntos necesarios', 'Points required')}</span>
              <input className={`${field} w-full`} type="number" min={0} step={1} value={rewardForm.pointsRequired}
                onChange={(event) => updateRewardForm({ pointsRequired: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Descripción', 'Description')}</span>
              <textarea className={`${field} w-full`} maxLength={2048} rows={1} value={rewardForm.description}
                onChange={(event) => updateRewardForm({ description: event.target.value })} />
            </label>
          </div>
          <details className="space-y-2">
            <summary className="cursor-pointer text-xs text-textSub">
              {t('Opciones avanzadas', 'Advanced options')}
            </summary>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
              <label className="space-y-1 text-xs text-textSub col-span-2 sm:col-span-4">
                <span>{t('Condiciones', 'Terms and conditions')}</span>
                <textarea className={`${field} w-full`} maxLength={4096} rows={1}
                  value={rewardForm.termsAndConditions}
                  onChange={(event) => updateRewardForm({ termsAndConditions: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Válido desde', 'Valid from')}</span>
                <input className={`${field} w-full`} type="datetime-local" value={rewardForm.validFrom}
                  onChange={(event) => updateRewardForm({ validFrom: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Válido hasta', 'Valid until')}</span>
                <input className={`${field} w-full`} type="datetime-local" value={rewardForm.validUntil}
                  onChange={(event) => updateRewardForm({ validUntil: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Canjes máximos en total', 'Maximum total redemptions')}</span>
                <input className={`${field} w-full`} type="number" min={1} step={1}
                  value={rewardForm.maxRedemptions}
                  onChange={(event) => updateRewardForm({ maxRedemptions: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Canjes máximos por usuario', 'Maximum redemptions per user')}</span>
                <input className={`${field} w-full`} type="number" min={1} step={1}
                  value={rewardForm.maxRedemptionsPerUser}
                  onChange={(event) => updateRewardForm({ maxRedemptionsPerUser: event.target.value })} />
              </label>
            </div>
          </details>
          <button type="button" className={`${action} py-1 text-xs`} disabled={busy || !editable || !validInitialStock || !canCreateReward || rewardCreationUncertain || program.catalog.length >= 32}
            onClick={() => void createKivlyReward()}>
            {busy ? t('Creando…', 'Creating…') : t('Crear en Kivly', 'Create in Kivly')}
          </button>
          </>}
        </section>}
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t('Buscar premios', 'Search prizes')}</span>
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textSub">⌕</span>
            <input type="search" aria-label={t('Buscar premios', 'Search prizes')} value={search}
              onChange={(event) => setSearch(event.target.value)} className={`${field} w-full pl-9`}
              placeholder={t('Buscar premio por nombre…', 'Search prize by name…')} />
          </label>
          <button type="button" className={`${action} h-10 w-10 p-0 text-lg`} aria-label={t('Premios anteriores', 'Previous prizes')}
            onClick={() => catalogScroller.current?.scrollBy({ left: -catalogScroller.current.clientWidth, behavior: 'smooth' })}>‹</button>
          <button type="button" className={`${action} h-10 w-10 p-0 text-lg`} aria-label={t('Premios siguientes', 'Next prizes')}
            onClick={() => catalogScroller.current?.scrollBy({ left: catalogScroller.current.clientWidth, behavior: 'smooth' })}>›</button>
        </div>
        <div ref={catalogScroller} className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
          {filteredPrizes.map((prize) => {
            const configured = program.catalog.some((item) => item.id === prize.id)
            const stock = data.inventory.find((item) => item.prizeId === prize.id)
            const delivered = stock ? Math.max(0, stock.total - stock.remaining) : 0
            const remaining = Math.max(0, prize.stockTotal - delivered)
            const actionsVisible = activeImageActions === prize.id
            return <article key={prize.id} aria-label={prize.name}
              className="min-w-0 shrink-0 basis-[78%] snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-sm sm:basis-[calc((100%_-_0.5rem)/2)] lg:basis-[calc((100%_-_1.5rem)/4)]">
              <div className="group relative aspect-[4/3] w-full overflow-hidden bg-transparent"
                onKeyDown={(event) => { if (event.key === 'Escape') setActiveImageActions(null) }}>
              <button type="button" className="block h-full w-full"
                aria-label={`${t('Opciones de imagen para', 'Image options for')} ${prize.name}`}
                aria-expanded={actionsVisible} onClick={() => setActiveImageActions(actionsVisible ? null : prize.id)}
                disabled={!configured && program.catalog.length >= 32}>
                {prize.imageUrl
                  ? <img src={prize.imageUrl} alt={`${t('Vista previa del premio', 'Prize preview')} ${prize.name}`} className="h-full w-full object-contain" />
                  : <span className="flex h-full items-center justify-center text-4xl font-black text-gray-300">{prize.name.slice(0, 1).toUpperCase()}</span>}
              </button>
                <div className={`absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2 bg-black/65 p-2 transition-opacity group-focus-within:opacity-100 group-focus-within:pointer-events-auto ${actionsVisible ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}>
                  <label className="cursor-pointer rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-950 focus-within:ring-2 focus-within:ring-primary">
                    {t('Subir', 'Upload')}
                    <input type="file" accept="image/png" className="sr-only" disabled={!configured && program.catalog.length >= 32}
                      aria-label={`${t('Imagen de', 'Image for')} ${prize.name}`} onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void chooseImage(prize, file)
                    }} />
                  </label>
                  {prize.imageUrl && configured && <button type="button" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700"
                    aria-label={`${t('Quitar imagen de', 'Remove image for')} ${prize.name}`}
                    onClick={() => {
                      const preview = previews.current.get(prize.id)
                      if (preview) URL.revokeObjectURL(preview)
                      previews.current.delete(prize.id)
                      change({ ...program, catalog: program.catalog.map((item) =>
                        item.id === prize.id ? { ...item, imageKey: null, imageUrl: null } : item) })
                    }}>{t('Quitar', 'Remove')}</button>}
                </div>
              </div>
              <div className="space-y-3 p-3">
                <div className="flex items-start gap-2">
                  <h4 className="min-w-0 flex-1 break-words font-semibold">{prize.name}</h4>
                  <span className="flex h-7 max-w-[5rem] shrink-0 items-center">
                    <img src={prize.source === 'kivly' ? '/images/logo-kivly-footer.png' : '/images/logo-stand-footer.png'}
                      alt={prize.source === 'kivly' ? 'Kivly' : 'STAND'} className="max-h-5 max-w-full object-contain" />
                  </span>
                </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-lg bg-black/15 p-2 text-textSub">{t('Entregados', 'Delivered')}: <strong className="text-textMain">{delivered}</strong></span>
                    <span className="rounded-lg bg-black/15 p-2 text-textSub">{t('Disponibles', 'Available')}: <strong className="text-textMain">{Number.isFinite(remaining) ? remaining : '—'}</strong></span>
                  </div>
                  <label className="block text-xs text-textSub">{t('Stock', 'Stock')}
                    <input type="number" min={1} max={1000} value={Number.isFinite(prize.stockTotal) ? prize.stockTotal : ''}
                      disabled={!configured && program.catalog.length >= 32}
                      className={`${field} mt-1 w-full text-textMain`}
                      aria-label={`${t('Inventario total Y de', 'Total stock Y for')} ${prize.name}`}
                      onChange={(event) => change({ ...program, catalog: configured
                        ? program.catalog.map((item) => item.id === prize.id ? { ...item, stockTotal: event.target.valueAsNumber } : item)
                        : [...program.catalog, { ...prize, id: newId(), stockTotal: event.target.valueAsNumber }] })} />
                  </label>
                {!configured && <button type="button" className={`${action} w-full`} disabled={program.catalog.length >= 32}
                  onClick={() => change({ ...program, catalog: [...program.catalog, { ...prize, id: newId() }] })}>
                  {t('Añadir al inventario', 'Add to stock')}
                </button>}
              </div>
            </article>
          })}
        </div>
        {filteredPrizes.length === 0 && <p className="py-6 text-center text-sm text-textSub">
          {t('No hay premios que coincidan con la búsqueda.', 'No prizes match your search.')}
        </p>}
        <p className="text-xs text-textSub">{t('Stock compartido entre reglas. Imágenes PNG, máx. 5 MB.',
          'Stock is shared between rules. PNG images, max. 5 MB.')}</p>
        <p className="text-xs text-textSub">{t('Las imágenes subidas se aplican a este juego; no modifican el catálogo externo de Kivly.',
          'Uploaded images apply to this game; they do not change the external Kivly catalog.')}</p>
      </section>
      <h3 className="text-sm font-semibold">{t('Cuándo y qué entregar', 'When and what to award')}</h3>
      {program.rules.map((rule, index) => <section key={index} aria-label={`${t('Regla', 'Rule')} ${index + 1}`}
        className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-primary">{t('Regla', 'Rule')} {index + 1}</span>
          <button type="button" className="text-xs text-textSub underline" aria-label={`${t('Quitar regla', 'Remove rule')} ${index + 1}`}
            onClick={() => change({ ...program, rules: program.rules.filter((_, i) => i !== index) })}>{t('Quitar regla', 'Remove rule')}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('Cuando', 'When')}</span>
          <select aria-label={`${t('Condición', 'Condition')} ${index + 1}`} className={`${selectField} flex-1`} value={rule.condition}
            onChange={(event) => {
              const condition = event.target.value as StackPrizeCondition
              updateRule(index, { ...rule, condition, topX: condition.startsWith('top_') ? 10 : undefined })
            }}>
            {conditions.filter((condition) => condition !== 'raffle' || raffles || rule.condition === 'raffle')
              .map((condition) => <option key={condition} value={condition}>{label(condition)}</option>)}
          </select>
          {rule.condition.startsWith('top_') && <label className="flex items-center gap-2">top
            <input type="number" min={1} max={100} value={Number.isFinite(rule.topX) ? rule.topX : ''} className={`${field} w-20`} aria-label={`Top ${index + 1}`}
              onChange={(event) => updateRule(index, { ...rule, topX: event.target.valueAsNumber })} />
          </label>}
        </div>
        {rule.groups.map((group, groupIndex) => <div key={groupIndex}>
          {groupIndex > 0 && <p className="py-2 text-center text-xs font-bold text-primary">{t('O · un grupo al azar', 'OR · one random group')}</p>}
          <div className="rounded-xl border border-white/15 bg-surface/50 p-3 space-y-2">
            <div className="flex justify-between gap-2 text-xs">
              <span>{t('Grupo', 'Group')} {groupIndex + 1}</span>
              {rule.groups.length > 1 && <button type="button" className="underline" aria-label={`${t('Quitar grupo', 'Remove group')} ${index + 1}.${groupIndex + 1}`}
                onClick={() => updateRule(index, { ...rule, groups: rule.groups.filter((_, i) => i !== groupIndex) })}>{t('Quitar grupo', 'Remove group')}</button>}
            </div>
            {group.allocations.map((allocation, allocationIndex) => {
              const prize = program.catalog.find((item) => item.id === allocation.prizeId)
              return <div key={allocation.prizeId}>
                {allocationIndex > 0 && <p className="text-xs font-bold text-primary py-1">{t('Y', 'AND')}</p>}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 break-words">{prize?.name}</span>
                  <label className="flex items-center gap-1 text-xs text-textSub">{t('Unid.', 'Qty.')}
                    <input type="number" min={1} max={10} value={Number.isFinite(allocation.quantity) ? allocation.quantity : ''} className={`${field} w-16`}
                      aria-label={`${t('Cantidad de', 'Quantity of')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
                      onChange={(event) => updateRule(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex ? {
                        allocations: item.allocations.map((entry, n) => n === allocationIndex ? { ...entry, quantity: event.target.valueAsNumber } : entry),
                      } : item) })} />
                  </label>
                  <button type="button" className="px-2 py-1 text-textSub" aria-label={`${t('Quitar premio', 'Remove prize')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
                    onClick={() => updateRule(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex
                      ? { allocations: item.allocations.filter((_, n) => n !== allocationIndex) } : item) })}>×</button>
                </div>
              </div>
            })}
            {group.allocations.length === 0 && <p className="text-xs text-amber-300">{t('Selecciona al menos un premio.', 'Select at least one prize.')}</p>}
            <select className={`${selectField} w-full`} aria-label={`${t('Añadir premio al grupo', 'Add prize to group')} ${index + 1}.${groupIndex + 1}`}
              value="" disabled={group.allocations.length >= 8} onChange={(event) => addPrize(index, groupIndex, event.target.value)}>
              <option value="">{group.allocations.length ? t('Y añadir premio…', 'AND add prize…') : t('Seleccionar premio…', 'Select prize…')}</option>
              {(['stand', 'kivly'] as const).map((source) => <optgroup key={source} label={source === 'stand' ? 'STAND' : 'Kivly'}>
                {available.filter((prize) => prize.source === source && !group.allocations.some((item) => item.prizeId === prize.id))
                  .map((prize) => <option key={prize.id} value={prize.id} disabled={program.catalog.length >= 32 && !program.catalog.some((item) => item.id === prize.id)}>{prize.name}</option>)}
              </optgroup>)}
            </select>
          </div>
        </div>)}
        <button type="button" className={action} disabled={rule.groups.length >= 8}
          onClick={() => updateRule(index, { ...rule, groups: [...rule.groups, { allocations: [] }] })}>{t('O añadir grupo', 'OR add group')}</button>
        <p className="text-xs text-textSub">{t('Sale un grupo al azar, con la misma probabilidad. Se entregan sus premios disponibles; los grupos agotados no participan.',
          'One group is chosen at random with equal probability. Its available prizes are awarded; exhausted groups are excluded.')}</p>
      </section>)}
      <button type="button" className={action} disabled={program.rules.length >= 8} onClick={() => change({ ...program,
        rules: [...program.rules, { id: newId(), condition: 'completed', groups: [{ allocations: [] }] }],
      })}>{t('Añadir regla', 'Add rule')}</button>
      <section className="rounded-xl border border-white/10 p-3 space-y-3">
        <label className="block text-sm font-semibold" htmlFor="stack-delivery-channel">
          {t('Entrega de premios Kivly', 'Kivly reward delivery')}
        </label>
        <select id="stack-delivery-channel" className={`${selectField} w-full`} value={program.deliveryChannel ?? 'wallet'}
          onChange={(event) => {
            if (event.target.value === 'wallet' || event.target.value === 'email')
              change({ ...program, deliveryChannel: event.target.value })
          }}>
          <option value="wallet">Wallet</option>
          <option value="email" disabled={!data.emailAvailable}>Email</option>
        </select>
        <p className="text-xs text-textSub">{t('Solo un canal. Los cambios se aplican a nuevas partidas; los premios STAND mantienen su QR.',
          'One channel only. Changes apply to new games; STAND prizes keep their QR.')}</p>
        {program.deliveryChannel === 'email' && <p className="text-xs text-textSub">{t(
          'Enviaremos el premio al email verificado con un QR del teléfono registrado en Kivly. No se necesita wallet.',
          'We will email the reward to the verified address with a QR of the phone registered in Kivly. No wallet needed.')}</p>}
        {!data.emailAvailable && <p className="text-xs text-amber-300">{t('El envío de premios por email aún no está habilitado en este entorno.',
          'Reward email delivery is not enabled in this environment yet.')}</p>}
      </section>
    </fieldset>
    {data.awards.some((award) => award.deliveryChannel === 'email') && <section className="rounded-xl border border-white/10 p-3 space-y-3">
      <h3 className="text-sm font-semibold">{t('Envíos de premios por email', 'Reward emails')}</h3>
      {data.awards.filter((award) => award.deliveryChannel === 'email').map((award) => <div key={award.id} className="text-sm space-y-1">
        <p>#{award.playerId} · {award.name} · {award.emailState ? emailStates[award.emailState] : award.state}</p>
        {award.emailError && <p role="alert" className="text-amber-300">{award.emailError === 'KivlyPhoneRequired'
          ? t('Falta un teléfono válido en Kivly. Corrige la ficha allí y reintenta el email.',
            'A valid phone is missing in Kivly. Correct the record there and retry the email.')
          : award.emailError}</p>}
        {award.emailState === 'failed' && <button type="button" className={action} disabled={busy || !data.emailAvailable}
          onClick={() => void run(async () => {
            const next = await stackPrizeApi.retryEmail(gameId, award.id)
            if (next.ok !== true) throw new Error(t('No se pudo reintentar el email.', 'Could not retry the email.'))
            setData(next)
          })}>{t('Reintentar email sin reasignar premio', 'Retry email without assigning again')}</button>}
      </div>)}
      <button type="button" className={action} disabled={busy} onClick={() => void run(async () => {
        const next = await stackPrizeApi.get(gameId)
        if (next.ok !== true) throw new Error(t('No se pudo actualizar el estado.', 'Could not refresh status.'))
        setData(next)
      })}>{t('Actualizar envíos', 'Refresh emails')}</button>
    </section>}
    </div>
    <div className="settings-footer border-t border-white/10 pt-3">
      <button type="button" className={`${action} w-full font-semibold`} disabled={busy || validatingImage || !editable || invalidProgram || (!dirty && data.enabled)}
        onClick={() => void save()}>{busy ? t('Guardando…', 'Saving…') : t('Guardar reglas de premios', 'Save prize rules')}</button>
    </div>
  </div>
}
