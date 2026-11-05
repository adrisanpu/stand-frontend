import { useEffect, useRef, useState } from 'react'
import { stackPrizeApi, type StackPrizeItem, type StackPrizeProgram, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import {
  kivlyApi, type KivlyReward, type KivlyRewardDetail, type KivlyRewardDraft, type KivlyRewardUpdate,
} from '../../api/kivlyApi'
import { PrizeImageError, uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import { fetchSharedPrizeCatalog, type SharedPrize } from '../../api/sharedPrizeCatalog'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import SaveButton from '../ui/SaveButton'
import { inventoryReasonText } from '../inventoryReason'

const field = 'rounded-xl border border-white/15 bg-surface px-3 py-2 text-sm min-w-0'
const selectField = 'stack-prize-select rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm min-w-0'
const action = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-40'
const newId = () => crypto.randomUUID()
const validCap = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0)

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

function dateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function isUncertainRewardCreation(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === 'KivlyRewardCreationUncertain') return true
  return 'isNetworkError' in error && error.isNetworkError === true
}

function isUncertainRewardUpdate(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === 'KivlyRewardUpdateUncertain') return true
  return 'isNetworkError' in error && error.isNetworkError === true
}

export default function StackPrizeSettings({ gameId, onPersist, onSavingChange, onDirtyChange }: {
  gameId: string
  raffles: boolean
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t, language } = useOperatorLanguage()
  const text = useRef(t)
  text.current = t
  const [data, setData] = useState<StackPrizeSettingsResponse | null>(null)
  const [program, setProgram] = useState<StackPrizeProgram | null>(null)
  const [rewards, setRewards] = useState<KivlyReward[]>([])
  const [sharedCatalog, setSharedCatalog] = useState<SharedPrize[]>([])
  const [sharedPrizeId, setSharedPrizeId] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [kivlyConnected, setKivlyConnected] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [rewardForm, setRewardForm] = useState<KivlyRewardForm>(emptyKivlyRewardForm)
  const [rewardError, setRewardError] = useState('')
  const [rewardMessage, setRewardMessage] = useState('')
  const [rewardCreationUncertain, setRewardCreationUncertain] = useState(false)
  const [rewardUpdateUncertain, setRewardUpdateUncertain] = useState(false)
  const [editingPrize, setEditingPrize] = useState<StackPrizeItem | null>(null)
  const [editingReward, setEditingReward] = useState<KivlyRewardDetail | null>(null)
  const [rewardImage, setRewardImage] = useState<File | null>(null)
  const [rewardImagePreview, setRewardImagePreview] = useState('')
  const [imageRemoved, setImageRemoved] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSource, setCreateSource] = useState<'stand' | 'kivly'>('stand')
  const [initialStock, setInitialStock] = useState<{ stand: number | null; kivly: number | null }>({ stand: null, kivly: null })
  const [validatingImage, setValidatingImage] = useState(false)
  const [search, setSearch] = useState('')
  const [activeImageActions, setActiveImageActions] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [catalogRevision, setCatalogRevision] = useState(0)
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
  useEffect(() => {
    let cancelled = false
    setData(null)
    setProgram(null)
    setError('')
    setDirty(false)
    onDirtyChange?.(false)
    void stackPrizeApi.get(gameId).then((response) => {
      if (cancelled) return
      if (response.ok !== true || response.program?.version !== 3) throw new Error('Invalid prize configuration')
      setData(response)
      setProgram({ ...response.program, deliveryChannel: 'wallet' })
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : text.current('No se pudieron cargar los premios.', 'Could not load prizes.'))
    })
    return () => { cancelled = true }
  }, [gameId, revision, onDirtyChange])
  useEffect(() => {
    let cancelled = false
    void fetchSharedPrizeCatalog().then(result => {
      if (!cancelled) setSharedCatalog(result.catalog)
    }).catch(() => {
      if (!cancelled) setCatalogError(text.current(
        'No se pudo cargar el catálogo general de premios.',
        'Could not load the shared prize catalog.',
      ))
    })
    return () => { cancelled = true }
  }, [gameId, catalogRevision])
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
    setEditingPrize(null)
    setEditingReward(null)
    setRewardImage(null)
    setRewardImagePreview('')
    setImageRemoved(false)
    setCreateOpen(false)
    setInitialStock({ stand: null, kivly: null })
    setSearch('')
    setRewardError('')
    setRewardMessage('')
    setRewardCreationUncertain(false)
    setRewardUpdateUncertain(false)
    uncertainRewardTitle.current = null
  }, [gameId])

  const change = (next: StackPrizeProgram) => {
    setProgram(next)
    setDirty(true)
    onDirtyChange?.(true)
    setMessage('')
  }
  const updateRewardForm = (patch: Partial<KivlyRewardForm>) => {
    setRewardForm((previous) => ({ ...previous, ...patch }))
    setRewardError('')
    setRewardMessage('')
  }
  const updateDraftImage = async (file: File) => {
    setValidatingImage(true)
    try {
      await validatePrizeImage(file)
      const preview = URL.createObjectURL(file)
      setRewardImage(file)
      setRewardImagePreview(preview)
      setImageRemoved(false)
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
    const saved = await stackPrizeApi.save(gameId, { ...program, deliveryChannel: 'wallet' })
    setProgram(saved)
    setDirty(false)
    onDirtyChange?.(false)
    setData((previous) => previous ? {
      ...previous, program: saved, enabled: true,
    } : previous)
    onPersist({ stackPrizeProgram: saved, prizeCatalog: {} })
    setMessage(t('Premios guardados. Los premios ya ganados se conservan.', 'Prizes saved. Previously earned prizes are preserved.'))
    try { setData(await stackPrizeApi.get(gameId)) } catch {
      setMessage(t('Premios guardados. No se pudo refrescar la disponibilidad; recarga para verla actualizada.',
        'Prizes saved. Availability could not be refreshed; reload to see updated balances.'))
    }
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
    const editing = editingPrize?.source === 'kivly' ? editingPrize : null
    const configured = editing ? program?.catalog.some((item) => item.id === editing.id) : false
    if (busy || !validCap(initialStock.kivly)
      || !program || (!editing && program.catalog.length >= 32)
      || (editing && !configured && program.catalog.length >= 32)
      || !kivlyConnected || !locationId || data?.state !== 'open'
      || rewardCreationUncertain || rewardUpdateUncertain || (editing && !editingReward)) return
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
    const update: KivlyRewardUpdate | null = editing && editingReward ? {
      ...draft,
      image: editingReward.image,
      termsAndConditions: draft.termsAndConditions ?? null,
      validFrom: draft.validFrom ?? null,
      validUntil: draft.validUntil ?? null,
      maxRedemptions: draft.maxRedemptions ?? null,
      maxRedemptionsPerUser: draft.maxRedemptionsPerUser ?? null,
    } : null
    setBusy(true)
    onSavingChange?.(true)
    setRewardError('')
    setRewardMessage('')
    let creationRequested = false
    let updateRequested = false
    try {
      const imageKey = rewardImage ? await uploadPrizeImage(gameId, 'ranking', rewardImage) : undefined
      if (editing && update) {
        updateRequested = true
        const reward = await kivlyApi.updateReward(gameId, editing.rewardId!, update)
        const id = configured ? editing.id : newId()
        const imageUrl = rewardImage ? URL.createObjectURL(rewardImage)
          : imageRemoved ? null : editing.imageUrl ?? null
        const oldPreview = previews.current.get(id)
        if (oldPreview) URL.revokeObjectURL(oldPreview)
        if (rewardImage && imageUrl) previews.current.set(id, imageUrl)
        else previews.current.delete(id)
        const nextPrize: StackPrizeItem = {
          ...editing, id, name: reward.name, stockTotal: initialStock.kivly,
          imageKey: imageKey ?? (imageRemoved ? null : editing.imageKey ?? null),
          imageUrl,
        }
        change({ ...program, catalog: configured
          ? program.catalog.map((item) => item.id === editing.id ? nextPrize : item)
          : [...program.catalog, nextPrize] })
        setRewards((previous) => previous.map((item) =>
          item.id === reward.id ? { ...item, name: reward.name } : item))
        resetPrizeForm()
        setMessage(t('Premio actualizado en Kivly. Guarda para aplicar el límite por evento y la imagen.',
          'Reward updated in Kivly. Save to apply the event cap and image.'))
      } else {
        creationRequested = true
        const reward = await kivlyApi.createReward(gameId, draft)
        const id = newId()
        const imageUrl = rewardImage ? URL.createObjectURL(rewardImage) : reward.imageUrl
        if (rewardImage && imageUrl) previews.current.set(id, imageUrl)
        change({ ...program, catalog: [...program.catalog, {
          id, source: 'kivly', rewardId: reward.id, locationId, name: reward.name,
          stockTotal: initialStock.kivly, ...(imageKey ? { imageKey } : {}), imageUrl,
        }] })
        resetPrizeForm()
        uncertainRewardTitle.current = null
        setRewardCreationUncertain(false)
        setMessage(t('Premio creado en Kivly. Guarda para aplicar el límite por evento y la imagen.',
          'Reward created in Kivly. Save to apply the event cap and image.'))
      }
      setCatalogRevision((revision) => revision + 1)
    } catch (cause) {
      if (creationRequested && isUncertainRewardCreation(cause)) {
        uncertainRewardTitle.current = draft.title
        setRewardCreationUncertain(true)
        setRewardError(t('No se pudo confirmar la creación. Actualiza el catálogo antes de volver a enviarla.',
          'Creation could not be confirmed. Refresh the catalog before submitting again.'))
      } else if (updateRequested && isUncertainRewardUpdate(cause)) {
        setRewardUpdateUncertain(true)
        setRewardError(t('No se pudo confirmar la actualización. Actualiza los datos del premio antes de volver a enviarla.',
          'The update could not be confirmed. Refresh the reward details before submitting again.'))
      } else {
        const code = typeof cause === 'object' && cause !== null && 'code' in cause
          && typeof cause.code === 'string' ? cause.code : ''
        const codeMessages: Record<string, string> = {
          KivlyWritesDisabled: t('Los cambios de premios Kivly están deshabilitados en este entorno.',
            'Kivly reward changes are disabled in this environment.'),
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
  const available = [...program.catalog, ...sharedCatalog.filter((prize) =>
    !program.catalog.some((item) => item.source === 'stand' && item.sharedPrizeId === prize.id))
    .map((prize): StackPrizeItem => ({
      id: `shared_${prize.id}`, source: 'stand', sharedPrizeId: prize.id, name: prize.name,
      imageKey: prize.imageKey, imageUrl: prize.imageUrl ?? null, stockTotal: null,
    })), ...rewards.filter((reward) => !program.catalog.some((prize) =>
    prize.source === 'kivly' && prize.rewardId === reward.id && prize.locationId === locationId)).map((reward): StackPrizeItem => ({
      id: `kivly_${reward.id}`, source: 'kivly', rewardId: reward.id, name: reward.name,
      locationId: locationId ?? '', stockTotal: null, imageUrl: reward.imageUrl,
    }))]
  const parsedRewardValue = Number(rewardForm.value)
  const parsedPointsRequired = Number(rewardForm.pointsRequired)
  const canCreateReward = rewardForm.title.trim().length > 0
    && rewardForm.description.trim().length > 0 && rewardForm.value.trim().length > 0
    && Number.isFinite(parsedRewardValue)
    && Number.isInteger(parsedPointsRequired) && parsedPointsRequired >= 0
  const invalidProgram = program.catalog.some((prize) => {
    return !validCap(prize.stockTotal)
  }) || program.rules.some((rule) => rule.groups.length === 0 || rule.groups.some((group) =>
    group.allocations.length === 0 || group.allocations.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10))
    || (rule.condition.startsWith('top_') && (!Number.isInteger(rule.topX) || (rule.topX ?? 0) < 1 || (rule.topX ?? 101) > 100))
    || (rule.condition === 'score' && (
      !Number.isSafeInteger(rule.scoreValue) || (rule.scoreValue ?? -1) < 0
      || (rule.scoreOperator === 'between' && (
        !Number.isSafeInteger(rule.scoreMaxValue) || (rule.scoreMaxValue ?? -1) < (rule.scoreValue ?? 0)
      ))
    )))
  const createStandPrize = () => run(async () => {
    const editing = editingPrize?.source === 'stand' ? editingPrize : null
    const shared = sharedCatalog.find((prize) => prize.id === sharedPrizeId)
    if (!program || !shared || (!editing && program.catalog.length >= 32)
      || !validCap(initialStock.stand)) return
    const id = editing?.id ?? newId()
    const imageKey = shared.imageKey
    const imageUrl = shared.imageUrl ?? null
    const previousPreview = previews.current.get(id)
    if (previousPreview) URL.revokeObjectURL(previousPreview)
    previews.current.delete(id)
    change({
      ...program,
      catalog: editing ? program.catalog.map((item) => item.id === id ? {
        ...item, name: shared.name, sharedPrizeId: shared.id, stockTotal: initialStock.stand, imageKey, imageUrl,
      } : item) : [...program.catalog, {
        id, source: 'stand', name: shared.name, sharedPrizeId: shared.id, limit: null, stockTotal: initialStock.stand,
        imageKey, imageUrl,
      }],
    })
    resetPrizeForm()
    setMessage(editing
      ? t('Premio STAND actualizado. Guarda para aplicar los cambios al juego.', 'STAND prize updated. Save to apply the changes to the game.')
      : '')
  })
  const resetPrizeForm = () => {
    setCreateOpen(false)
    setEditingPrize(null)
    setEditingReward(null)
    setCreateSource('stand')
    setSharedPrizeId('')
    setRewardForm(emptyKivlyRewardForm)
    setRewardImage(null)
    setRewardImagePreview('')
    setImageRemoved(false)
    setInitialStock({ stand: null, kivly: null })
    setRewardError('')
    setRewardMessage('')
    setRewardCreationUncertain(false)
    setRewardUpdateUncertain(false)
  }
  const openCreateForm = () => {
    resetPrizeForm()
    setCreateOpen(true)
  }
  const setKivlyEditForm = (prize: StackPrizeItem, reward: KivlyRewardDetail) => {
    setEditingPrize(prize)
    setEditingReward(reward)
    setCreateSource('kivly')
    setRewardForm({
      title: reward.title,
      description: reward.description,
      rewardType: reward.rewardType,
      value: String(reward.value),
      pointsRequired: String(reward.pointsRequired),
      termsAndConditions: reward.termsAndConditions ?? '',
      validFrom: dateTimeLocal(reward.validFrom),
      validUntil: dateTimeLocal(reward.validUntil),
      maxRedemptions: reward.maxRedemptions == null ? '' : String(reward.maxRedemptions),
      maxRedemptionsPerUser: reward.maxRedemptionsPerUser == null ? '' : String(reward.maxRedemptionsPerUser),
    })
    setInitialStock((previous) => ({ ...previous, kivly: prize.stockTotal }))
    setRewardImage(null)
    setRewardImagePreview(prize.imageUrl ?? '')
    setImageRemoved(false)
    setRewardError('')
    setRewardMessage('')
    setRewardUpdateUncertain(false)
    setCreateOpen(true)
  }
  const openEdit = (prize: StackPrizeItem) => {
    setError('')
    setMessage('')
    resetPrizeForm()
    if (prize.source === 'stand') {
      setEditingPrize(prize)
      setEditingReward(null)
      setCreateSource('stand')
      setSharedPrizeId(prize.sharedPrizeId ?? sharedCatalog.find((item) =>
        item.name === prize.name && item.imageKey === prize.imageKey)?.id ?? '')
      setInitialStock((previous) => ({ ...previous, stand: prize.stockTotal }))
      setImageRemoved(false)
      setRewardError('')
      setCreateOpen(true)
      return
    }
    if (!prize.rewardId) {
      setError(t('No se puede identificar el premio de Kivly.', 'Could not identify the Kivly reward.'))
      return
    }
    void run(async () => {
      const detail = await kivlyApi.getReward(gameId, prize.rewardId!)
      setKivlyEditForm(prize, detail)
    })
  }
  const refreshEditingReward = () => {
    const rewardId = editingPrize?.rewardId
    if (!editingPrize || !rewardId) return
    void run(async () => {
      const detail = await kivlyApi.getReward(gameId, rewardId)
      setKivlyEditForm(editingPrize, detail)
      setRewardMessage(t('Datos actualizados desde Kivly. Revisa antes de volver a guardar.',
        'Details refreshed from Kivly. Review them before saving again.'))
    })
  }
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredPrizes = available.filter((prize) =>
    prize.name.toLocaleLowerCase().includes(normalizedSearch))
  const validInitialStock = validCap(initialStock[createSource])
  const emailStates = {
    blocked: t('Premio pendiente de confirmación; correo aún no encolado', 'Reward awaiting confirmation; email not yet queued'),
    pending: t('Pendiente de envío', 'Waiting to send'),
    sending: t('Enviando', 'Sending'),
    accepted: t('Aceptado por SES; entrega en bandeja no confirmada', 'Accepted by SES; inbox delivery not confirmed'),
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
            <p className="text-xs text-textSub">{t('Selecciona premios y configura límites opcionales por evento.', 'Select prizes and configure optional event caps.')}</p>
          </div>
          <button type="button" className={`${action} font-semibold`} aria-expanded={createOpen}
            onClick={() => createOpen ? resetPrizeForm() : openCreateForm()}>
            {createOpen ? t('Cerrar', 'Close') : t('+ CREAR', '+ CREATE')}
          </button>
        </div>
        {createOpen && <section aria-label={editingPrize ? t('Editar premio', 'Edit prize') : t('Crear premio', 'Create prize')}
          className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 [&_input:not([type=file])]:h-8 [&_input]:px-2 [&_input]:py-1 [&_input]:text-xs [&_select]:h-8 [&_select]:px-2 [&_select]:py-1 [&_select]:text-xs [&_textarea]:px-2 [&_textarea]:py-1 [&_textarea]:text-xs">
          <h4 className="text-sm font-semibold">{editingPrize
            ? t('Editar premio', 'Edit prize') : t('Crear premio', 'Create prize')}</h4>
          {rewardError && <p role="alert" className="text-xs text-red-300">{rewardError}</p>}
          <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-4">
            <label className="space-y-1 text-xs text-textSub">
              <span>{t('Origen del premio', 'Prize source')}</span>
              <select className={`${selectField} w-full`} value={createSource}
                disabled={!!editingPrize}
                onChange={(event) => setCreateSource(event.target.value as 'stand' | 'kivly')}>
                <option value="stand">STAND</option>
                <option value="kivly" disabled={!kivlyConnected || !locationId}>Kivly</option>
              </select>
            </label>
              {createSource === 'stand'
                ? <label className="space-y-1 text-xs text-textSub">
                  <span>{t('Premio del catálogo general', 'Shared catalog prize')}</span>
                  <select className={`${selectField} w-full`} value={sharedPrizeId} disabled={!!editingPrize}
                    onChange={(event) => {
                      const selected = sharedCatalog.find((prize) => prize.id === event.target.value)
                      setSharedPrizeId(selected?.id ?? '')
                    }}>
                    <option value="">{t('Selecciona un premio', 'Select a prize')}</option>
                    {sharedCatalog.map((prize) => <option key={prize.id} value={prize.id}>{prize.name}</option>)}
                  </select>
                </label>
                : <label className="space-y-1 text-xs text-textSub">
                <span>{t('Nombre', 'Name')}</span>
                <input aria-label={t('Nombre', 'Name')}
                  value={rewardForm.title} maxLength={200}
                  onChange={(event) => updateRewardForm({ title: event.target.value })} className={`${field} w-full`}
                  placeholder={t('Nombre del nuevo premio', 'New prize name')} />
                </label>}
              <label className="space-y-1 text-xs text-textSub">
                <span>{t('Límite opcional por evento', 'Optional event cap')}</span>
                <input type="number" min={0} step={1} className={`${field} w-full`} placeholder={t('Sin límite', 'Unlimited')}
                  value={initialStock[createSource] ?? ''}
                  onChange={(event) => setInitialStock({ ...initialStock, [createSource]: event.target.value === '' ? null : event.target.valueAsNumber })} />
              </label>
              {createSource === 'stand'
                ? <div className="space-y-1 text-xs text-textSub">
                  <span>{t('Imagen del catálogo general', 'Shared catalog image')}</span>
                  {sharedCatalog.find((prize) => prize.id === sharedPrizeId)?.imageUrl
                    ? <img src={sharedCatalog.find((prize) => prize.id === sharedPrizeId)?.imageUrl ?? ''}
                        alt="" className="h-8 w-8 rounded object-contain" />
                    : <span className="text-xs">{t('Sin imagen', 'No image')}</span>}
                </div>
                : <div className="space-y-1 text-xs text-textSub">
                <label className="block space-y-1">
                  <span>{t('Imagen PNG', 'PNG image')}</span>
                  <span className="flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/25 px-2 text-xs hover:border-primary/60">
                    {rewardImagePreview && <img
                      src={rewardImagePreview}
                      alt={editingPrize ? t('Vista previa del premio', 'Prize preview') : t('Vista previa del nuevo premio', 'New prize preview')}
                      className="h-6 w-6 shrink-0 object-contain" />}
                    <span className="truncate">{rewardImage?.name ?? t('Subir imagen', 'Upload image')}</span>
                    <input type="file" accept="image/png" className="sr-only"
                      aria-label={t('Imagen del nuevo premio Kivly', 'New Kivly reward image')}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void updateDraftImage(file)
                      }} />
                  </span>
                </label>
                {rewardImagePreview && <button type="button"
                  className="text-xs underline" onClick={() => {
                    setRewardImage(null)
                    setRewardImagePreview('')
                    setImageRemoved(!!editingPrize)
                  }}>{t('Quitar imagen', 'Remove image')}</button>}
                </div>}
            </div>
          {!validInitialStock && <p role="alert" className="text-xs text-red-300">{t('El límite debe ser un entero ≥ 0 o vacío (sin límite).', 'Cap must be a whole number ≥ 0 or empty (unlimited).')}</p>}
          {createSource === 'stand' ? <>
            <SaveButton disabled={!sharedPrizeId || !validInitialStock || (!editingPrize && program.catalog.length >= 32)}
              onClick={() => void createStandPrize()}>{editingPrize
                ? t('Guardar cambios', 'Save changes') : t('Crear premio STAND', 'Create STAND prize')}</SaveButton>
          </> : <>
          {rewardMessage && <p role="status" className="text-xs text-textSub">{rewardMessage}</p>}
          {rewardCreationUncertain && <button type="button" className={action} disabled={busy}
            onClick={() => setCatalogRevision((revision) => revision + 1)}>
            {t('Actualizar catálogo y revisar', 'Refresh catalog and review')}
          </button>}
          {rewardUpdateUncertain && <button type="button" className={action} disabled={busy}
            onClick={refreshEditingReward}>
            {t('Actualizar datos de Kivly y revisar', 'Refresh Kivly details and review')}
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
          <div className="space-y-2 rounded-lg border border-white/10 p-2">
            <h5 className="text-xs font-medium text-textSub">{t('Vigencia y límites de canje', 'Validity and redemption limits')}</h5>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          </div>
          <SaveButton disabled={busy || !editable || !validInitialStock || !canCreateReward
            || rewardCreationUncertain || rewardUpdateUncertain
            || (!editingPrize && program.catalog.length >= 32)
            || (!!editingPrize && !program.catalog.some((item) => item.id === editingPrize.id) && program.catalog.length >= 32)}
            onClick={() => void createKivlyReward()}>
            {busy ? t('Guardando…', 'Saving…') : editingPrize
              ? t('Guardar cambios en Kivly', 'Save changes in Kivly') : t('Crear en Kivly', 'Create in Kivly')}
          </SaveButton>
          {editingPrize && <button type="button" className="text-xs underline" onClick={resetPrizeForm}>
            {t('Cancelar', 'Cancel')}
          </button>}
          </>}
          {createSource === 'stand' && editingPrize && <button type="button" className="text-xs underline"
            onClick={resetPrizeForm}>{t('Cancelar', 'Cancel')}</button>}
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
            const shared = data.globalInventory?.find(item => item.prizeId === prize.id)
            const actionsVisible = activeImageActions === prize.id
            return <article key={prize.id} aria-label={prize.name}
              className="min-w-0 shrink-0 basis-[78%] snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-sm sm:basis-[calc((100%_-_0.5rem)/2)] lg:basis-[calc((100%_-_1.5rem)/4)]">
              <div className="group relative aspect-[4/3] w-full overflow-hidden bg-transparent"
                onKeyDown={(event) => { if (event.key === 'Escape') setActiveImageActions(null) }}>
              <button type="button" className="block h-full w-full"
                aria-label={`${t('Opciones de imagen para', 'Image options for')} ${prize.name}`}
                aria-expanded={actionsVisible} onClick={() => setActiveImageActions(actionsVisible ? null : prize.id)}
                disabled={prize.source === 'stand' || (!configured && program.catalog.length >= 32)}>
                {prize.imageUrl
                  ? <img src={prize.imageUrl} alt={`${t('Vista previa del premio', 'Prize preview')} ${prize.name}`} className="h-full w-full object-contain" />
                  : <span className="flex h-full items-center justify-center text-4xl font-black text-gray-300">{prize.name.slice(0, 1).toUpperCase()}</span>}
              </button>
                {prize.source === 'kivly' && <div className={`absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2 bg-black/65 p-2 transition-opacity group-focus-within:opacity-100 group-focus-within:pointer-events-auto ${actionsVisible ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}>
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
                </div>}
              </div>
              <div className="space-y-3 p-3">
                <div className="flex items-start gap-2">
                  <h4 className="min-w-0 flex-1 break-words font-semibold">{prize.name}</h4>
                  <span className="flex h-7 max-w-[5rem] shrink-0 items-center">
                    <img src={prize.source === 'kivly' ? '/images/logo-kivly-footer.png' : '/images/logo-stand-footer.png'}
                      alt={prize.source === 'kivly' ? 'Kivly' : 'STAND'} className="max-h-5 max-w-full object-contain" />
                  </span>
                  <button type="button" className="shrink-0 text-xs underline" disabled={!configured}
                    aria-label={`${t('Editar premio', 'Edit prize')} ${prize.name}`}
                    onClick={() => openEdit(prize)}>
                    {t('Editar', 'Edit')}
                  </button>
                </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-lg bg-black/15 p-2 text-textSub">{t('Margen del evento', 'Event allowance')}: <strong className="text-textMain">{prize.stockTotal === null ? t('Sin límite', 'Unlimited') : stock?.remaining ?? '—'}</strong></span>
                    <span className="rounded-lg bg-black/15 p-2 text-textSub">{t('Disponible compartido', 'Shared available')}: <strong className="text-textMain">{shared ? shared.reason ? t('No disponible', 'Unavailable') : shared.remaining : '—'}</strong></span>
                  </div>
                  {shared?.reason && <p className="text-xs text-textSub">{inventoryReasonText(shared.reason, language)} ({shared.reason})</p>}
                  {prize.stockTotal === 0 && <p className="text-xs text-amber-300">{t('Límite por evento: 0. Esta partida no repartirá este premio.',
                    'Event cap: 0. This event will not award this prize.')}</p>}
                  {shared && !shared.reason && shared.remaining === 0 && <p className="text-xs text-amber-300">
                    {inventoryReasonText('out_of_stock', language)}
                  </p>}
                  <label className="block text-xs text-textSub">{t('Límite opcional por evento', 'Optional event cap')}
                    <input type="number" min={0} value={prize.stockTotal ?? ''} placeholder={t('Sin límite', 'Unlimited')}
                      disabled={!configured && program.catalog.length >= 32}
                      className={`${field} mt-1 w-full text-textMain`}
                      aria-label={`${t('Límite por evento de', 'Event cap for')} ${prize.name}`}
                      onChange={(event) => change({ ...program, catalog: configured
                        ? program.catalog.map((item) => item.id === prize.id ? { ...item, stockTotal: event.target.value === '' ? null : event.target.valueAsNumber } : item)
                        : [...program.catalog, { ...prize, id: newId(), stockTotal: event.target.value === '' ? null : event.target.valueAsNumber }] })} />
                  </label>
                {!configured && <button type="button" className={`${action} w-full`} disabled={program.catalog.length >= 32}
                  onClick={() => change({ ...program, catalog: [...program.catalog, { ...prize, id: newId() }] })}>
                  {t('Añadir a la partida', 'Add to event')}
                </button>}
              </div>
            </article>
          })}
        </div>
        {filteredPrizes.length === 0 && <p className="py-6 text-center text-sm text-textSub">
          {t('No hay premios que coincidan con la búsqueda.', 'No prizes match your search.')}
        </p>}
        <p className="text-xs text-textSub">{t('El límite es opcional y solo restringe esta partida; vacío significa sin límite. El stock físico se gestiona en Administración > Premios.',
          'The optional cap only restricts this event; blank means unlimited. Manage physical stock in Administration > Prizes.')}{' '}
          <a href="/admin/prizes" className="underline">{t('Abrir inventario general', 'Open general inventory')}</a></p>
        {data.globalInventory == null && <p className="text-xs text-amber-300">{t('Modo anterior: la partida mantiene su stock previo hasta activar el inventario general.',
          'Legacy mode: this event keeps its previous stock until general inventory activation.')}</p>}
        <p className="text-xs text-textSub">{t('El nombre y la imagen se administran en el catálogo general de Premios.',
          'Names and images are managed in the shared Prizes catalog.')}</p>
      </section>
      {data.allocations.some(item => item.inventoryReasons && Object.keys(item.inventoryReasons).length > 0) && <section className="space-y-2 text-sm"
        aria-label={t('Premios no asignados por inventario', 'Prizes not assigned due to inventory')}>
        <h3 className="font-semibold">{t('Incidencias de inventario por participante', 'Participant inventory issues')}</h3>
        {data.allocations.map(item => {
          const reasons = Array.isArray(item.inventoryReasons) ? item.inventoryReasons
            : Object.entries(item.inventoryReasons ?? {}).map(([prizeId, reason]) => ({ prizeId, reason }))
          return reasons.map(({ prizeId, reason }) => <p key={`${item.playerId}:${item.ruleId}:${prizeId}`}>
            #{item.playerId} · {program.catalog.find(prize => prize.id === prizeId)?.name ?? prizeId} · {inventoryReasonText(reason, language)} ({reason})
          </p>)
        })}
      </section>}
      <p className="text-sm text-textSub">{t(
        'Las condiciones se configuran desde el icono de ajustes de la partida en Administración > Juegos.',
        'Configure conditions using the event settings icon in Administration > Games.',
      )}</p>
      <section className="rounded-xl border border-white/10 p-3 space-y-2">
        <h3 className="text-sm font-semibold">{t('Entrega de premios', 'Reward delivery')}</h3>
        <p className="text-xs text-textSub">{t(
          'STAND entrega sus premios mediante su tarjeta Wallet y envía el enlace al correo verificado. Si Kivly está conectado, los premios Kivly usan automáticamente su enlace Wallet.',
          'STAND delivers its prizes through a STAND Wallet pass and emails the link to the verified address. When Kivly is connected, Kivly rewards automatically use their Kivly Wallet link.',
        )}</p>
        {!data.emailAvailable && <p className="text-xs text-amber-300">{t(
          'El envío de premios por correo aún no está habilitado en este entorno.',
          'Reward email delivery is not enabled in this environment yet.',
        )}</p>}
      </section>
    </fieldset>
    {data.awards.some((award) => award.emailState) && <section className="rounded-xl border border-white/10 p-3 space-y-3">
      <h3 className="text-sm font-semibold">{t('Envíos de premios por email', 'Reward emails')}</h3>
      {data.awards.filter((award) => award.emailState).map((award) => <div key={award.id} className="text-sm space-y-1">
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
      <SaveButton className="w-full" disabled={busy || validatingImage || !editable || invalidProgram || (!dirty && data.enabled)}
        onClick={() => void save()}>{busy ? t('Guardando…', 'Saving…') : t('Guardar premios', 'Save prizes')}</SaveButton>
    </div>
  </div>
}
