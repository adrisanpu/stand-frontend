import { useEffect, useRef, useState } from 'react'
import { exportFormResults, getGameForm, saveGameForm } from '../../api/gameForms'
import { fetchUserMedia, uploadLibraryImage, type UserMediaItem } from '../../api/userMedia'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { formDraft, validateFormDraft, type GameFormConfig, type GameFormDraft, type GameFormResponse } from '../formConfig'
import { getGameById } from '../../games'
import { QuizCard } from '../participant/ParticipantQuiz'
import ParticipantPhonePreview, { type ParticipantPhoneFrame } from '../participant/ParticipantPhonePreview'
import { resolveParticipantPalette } from '../theme/theme'
import type { PrizeCatalog } from '../prizes'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import QRCode from '../widgets/QRCode'
import HomeCanvasEditor from '../home/HomeCanvasEditor'
import JoinForm from '../participant/JoinForm'
import { OPTIONAL_REGISTRATION_FIELDS, resolveParticipantFields } from '../lib/participantFields'
import IconButton from '../ui/IconButton'
import SaveButton from '../ui/SaveButton'
import MediaPicker from '../ui/MediaPicker'

export default function GameFormSettings({ gameId, gameName, readOnly = false, section, prizeCatalog, onDirtyChange, onBusyChange, onReadyChange, onSectionDirtyChange, onFrameChange }: {
  gameId: string
  gameName?: string
  readOnly?: boolean
  section?: 'appearance' | 'registration' | 'questionnaire'
  prizeCatalog?: PrizeCatalog
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
  onReadyChange?: (section: 'appearance' | 'registration' | 'questionnaire', ready: boolean) => void
  onSectionDirtyChange?: (section: 'appearance' | 'registration' | 'questionnaire', dirty: boolean) => void
  /** Reports the participant look (theme, logo, banner) from the current draft so other previews can match it. */
  onFrameChange?: (frame: ParticipantPhoneFrame) => void
}) {
  const { t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [confirmed, setConfirmed] = useState<GameFormResponse | null>(null)
  const [draft, setDraft] = useState<GameFormDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const canvasBusy = useRef(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [reload, setReload] = useState(0)
  const [discardReload, setDiscardReload] = useState(false)
  const [previewSelection, setPreview] = useState<'registration' | 'quiz'>('registration')
  const preview = section && section !== 'appearance' ? (section === 'registration' ? 'registration' : 'quiz') : previewSelection
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [logoLibrary, setLogoLibrary] = useState<UserMediaItem[]>([])
  const [canvasDirty, setCanvasDirty] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)
  const [canvasMounted, setCanvasMounted] = useState(section === 'appearance')
  useEffect(() => { if (section === 'appearance') setCanvasMounted(true) }, [section])
  const dirty = !!draft && !!confirmed && JSON.stringify(draft) !== JSON.stringify(formDraft(confirmed))
  const appearanceDirty = !!draft && !!confirmed
    && JSON.stringify(draft.formConfig.appearance) !== JSON.stringify(confirmed.formConfig.appearance)
  const callbacks = useRef({ onBusyChange, onDirtyChange, onReadyChange, onSectionDirtyChange, onFrameChange })
  callbacks.current = { onBusyChange, onDirtyChange, onReadyChange, onSectionDirtyChange, onFrameChange }
  useEffect(() => { callbacks.current.onDirtyChange?.(dirty || canvasDirty) }, [dirty, canvasDirty])
  useEffect(() => {
    if (!draft || !confirmed) return
    const saved = formDraft(confirmed)
    callbacks.current.onSectionDirtyChange?.('appearance', canvasDirty)
    callbacks.current.onSectionDirtyChange?.('registration',
      draft.formConfig.registrationTitle !== saved.formConfig.registrationTitle
      || draft.formConfig.registrationDescription !== saved.formConfig.registrationDescription
      || (draft.formConfig.defaultLanguage ?? 'es') !== (saved.formConfig.defaultLanguage ?? 'es')
      || draft.formConfig.logoKey !== saved.formConfig.logoKey
      || appearanceDirty
      || JSON.stringify(draft.participantFields) !== JSON.stringify(saved.participantFields))
    callbacks.current.onSectionDirtyChange?.('questionnaire',
      draft.formConfig.quizTitle !== saved.formConfig.quizTitle
      || draft.formConfig.quizDescription !== saved.formConfig.quizDescription
      || draft.formConfig.logoKey !== saved.formConfig.logoKey
      || draft.formConfig.quizMoment !== saved.formConfig.quizMoment
      || JSON.stringify(draft.questions) !== JSON.stringify(saved.questions))
  }, [draft, confirmed, canvasDirty, appearanceDirty])
  useEffect(() => {
    const ready = !!draft && !!confirmed && !busy && !dirty && !error && !uncertain
      && !validateFormDraft(draft, confirmed.questions)
    callbacks.current.onReadyChange?.('registration', ready)
    callbacks.current.onReadyChange?.('questionnaire', ready)
  }, [draft, confirmed, busy, dirty, error, uncertain])
  useEffect(() => {
    callbacks.current.onReadyChange?.('appearance', canvasReady && !busy && !error && !uncertain)
  }, [canvasReady, busy, error, uncertain])
  useEffect(() => () => {
    callbacks.current.onBusyChange?.(false)
    callbacks.current.onDirtyChange?.(false)
  }, [])
  useEffect(() => {
    let active = true
    busyRef.current = true
    setBusy(true)
    callbacks.current.onBusyChange?.(true)
    setError('')
    setCanvasReady(false)
    void getGameForm(gameId).then(data => {
      if (!active) return
      setConfirmed(data)
      setDraft(formDraft(data))
      setUncertain(false)
      setAnswers({})
      setStatus('')
    }).catch(() => {
      if (active) setError(t('No se pudo cargar el formulario. Reintenta la carga.', 'Could not load the form. Retry loading.'))
    }).finally(() => {
      if (!active) return
      busyRef.current = false
      setBusy(false)
      callbacks.current.onBusyChange?.(canvasBusy.current)
    })
    return () => { active = false }
  }, [gameId, reload, t])

  const disabled = busy || readOnly || confirmed?.readOnly || uncertain
  const logoKey = draft?.formConfig.logoKey
  const frame: ParticipantPhoneFrame = {
    appearance: draft?.formConfig.appearance ?? null,
    logoUrl: logoKey
      ? logoLibrary.find(item => item.key === logoKey)?.url
        ?? (logoKey === confirmed?.formConfig.logoKey ? confirmed?.logoUrl : null) ?? null
      : null,
    bannerUrl: confirmed?.bannerUrl ?? null,
  }
  const frameSignature = draft && confirmed ? JSON.stringify(frame) : ''
  useEffect(() => {
    if (frameSignature) callbacks.current.onFrameChange?.(JSON.parse(frameSignature) as ParticipantPhoneFrame)
  }, [frameSignature])
  const changeConfig = (patch: Partial<GameFormConfig>) => {
    setDraft(current => current ? { ...current, formConfig: { ...current.formConfig, ...patch } } : current)
    setStatus('')
  }
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    callbacks.current.onBusyChange?.(true)
    setError('')
    try { await action() } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('No se pudo completar la operación.', 'Could not complete the operation.'))
    } finally {
      busyRef.current = false
      setBusy(false)
      callbacks.current.onBusyChange?.(canvasBusy.current)
    }
  }
  const save = () => {
    if (!draft || !confirmed || disabled) return
    const invalid = validateFormDraft(draft, confirmed.questions)
    if (invalid) { setError(invalid); return }
    void run(async () => {
      try {
        const result = await saveGameForm(gameId, draft, confirmed.revision, confirmed.questions)
        setConfirmed(result)
        setDraft(formDraft(result))
        setStatus(section === 'questionnaire'
          ? t('Cuestionario guardado y confirmado.', 'Questionnaire saved and confirmed.')
          : section === 'appearance' || (section === 'registration' && appearanceDirty)
            ? t('Colores de la partida guardados y confirmados.', 'Event colors saved and confirmed.')
            : t('Formulario guardado y confirmado.', 'Form saved and confirmed.'))
      } catch (reason) {
        setUncertain(true)
        throw new Error(`${t('No se ha confirmado el guardado. Recarga antes de reintentar.', 'Saving was not confirmed. Reload before retrying.')} ${reason instanceof Error ? reason.message : ''}`)
      }
    })
  }
  if (!draft || !confirmed) return <div className="space-y-3">
    {busy && <p role="status">{t('Cargando formulario…', 'Loading form…')}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="flex justify-end">
      <IconButton icon="reload" className="!h-11 !w-11" label={t('Recargar formulario', 'Reload form')} disabled={busy}
        onClick={() => setReload(value => value + 1)} />
    </div>
  </div>

  const config = draft.formConfig
  const defaultLanguage = config.defaultLanguage ?? 'es'
  const palette = resolveParticipantPalette(getGameById(confirmed.gameType) ?? null, config.appearance)
  const effectivePrimary = config.appearance?.colors?.primary ?? palette.variables['--color-primary']
  const effectiveAccent = config.appearance?.colors?.accent ?? palette.variables['--color-accent']
  const imageUrl = (kind: 'logo' | 'banner') => kind === 'logo' ? frame.logoUrl : frame.bannerUrl
  const momentLabels = [
    ['disabled', t('Desactivado', 'Disabled')],
    ['after_registration', t('Después del registro', 'After registration')],
    ['after_game', t('Después del juego', 'After the game')],
    ['prize', t('Antes de recoger un premio', 'Before claiming a prize')],
    ['raffle', t('Antes de participar en el sorteo', 'Before entering the raffle')],
  ] as const
  const updateQuestion = (index: number, patch: Partial<GameFormDraft['questions'][number]>) =>
    setDraft(current => current ? { ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...patch } : question) } : current)

  return <div className="space-y-4">
    {section !== 'appearance' && !features.playerForms && <p role="status">{t('El cuestionario está disponible en el plan Event 24h. Puedes editar los textos y los campos opcionales del registro.', 'Questionnaires are available on the Event 24h plan. You can edit registration text and optional fields.')}</p>}
    {(readOnly || confirmed.readOnly) && <p role="status">{t('Formulario en modo solo lectura.', 'This form is read only.')}</p>}
    {(!section || section === 'questionnaire') && confirmed.locked && <p role="status">{features.playerForms
      ? t('Ya hay respuestas: las preguntas y el momento están bloqueados. Puedes desactivar el cuestionario y volver a activarlo en el mismo momento.', 'Responses exist: questions and timing are locked. You can disable the questionnaire and reactivate it at the same time.')
      : t('Ya hay respuestas: las preguntas y el momento están bloqueados. Puedes desactivar el cuestionario; para volver a activarlo necesitas el plan Event 24h.', 'Responses exist: questions and timing are locked. You can disable the questionnaire; reactivation requires the Event 24h plan.')}</p>}
    {section && section !== 'appearance' && <p className="text-xs">{t('Guardar aplica los cambios pendientes de registro y cuestionario. El lienzo del Home se guarda por separado en Home.', 'Saving applies pending registration and questionnaire changes. The Home canvas is saved separately in Home.')}</p>}
    {canvasMounted && <div hidden={section !== 'appearance'}>
      {section === 'appearance' && error && <p role="alert">{error}</p>}
      {section === 'appearance' && status && <p role="status">{status}</p>}
      <HomeCanvasEditor gameId={gameId} gameName={gameName ?? gameId} appearance={config.appearance}
        logoSrc={imageUrl('logo')} advanced={features.advancedCustomization}
        readOnly={readOnly || confirmed.readOnly || uncertain} onDirtyChange={setCanvasDirty}
        onReadyChange={ready => {
          setCanvasReady(ready)
          callbacks.current.onReadyChange?.('appearance', ready && !busy && !uncertain)
        }}
        onBusyChange={value => {
          canvasBusy.current = value
          callbacks.current.onBusyChange?.(value || busyRef.current)
        }} />
    </div>}
    {section !== 'appearance' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <fieldset disabled={disabled} className="space-y-4">
          <legend className="mb-3 text-lg font-semibold">{t('Contenido', 'Content')}</legend>
          {(!section || section === 'registration') && <label className="block text-sm">
            {t('Idioma por defecto', 'Default language')}
            <select className="ml-2 rounded-lg border border-current/20 bg-surface px-2 py-1"
              value={defaultLanguage} onChange={event => changeConfig({ defaultLanguage: event.target.value === 'en' ? 'en' : 'es' })}>
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </label>}
          {section === 'registration' && <fieldset disabled={!features.advancedCustomization}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-current/15 px-3 py-2">
            <legend className="px-1 text-sm font-medium">{t('Colores de la partida', 'Event colors')}</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">{t('Primario', 'Primary')}
                <input type="color" aria-label={t('Color primario de la partida', 'Event primary color')}
                  value={effectivePrimary} onChange={event => changeConfig({ appearance: {
                    themeMode: config.appearance?.themeMode ?? 'dark',
                    colors: { primary: event.target.value, accent: effectiveAccent },
                  } })} />
              </label>
              <label className="flex items-center gap-1.5 text-sm">{t('Acento', 'Accent')}
                <input type="color" aria-label={t('Color de acento de la partida', 'Event accent color')}
                  value={effectiveAccent} onChange={event => changeConfig({ appearance: {
                    themeMode: config.appearance?.themeMode ?? 'dark',
                    colors: { primary: effectivePrimary, accent: event.target.value },
                  } })} />
              </label>
              <button type="button" className="text-sm underline" disabled={!config.appearance?.colors}
                onClick={() => changeConfig({ appearance: config.appearance
                  ? { ...config.appearance, colors: null } : null })}>
                {t('Restablecer', 'Reset')}
              </button>
            </div>
            {!features.advancedCustomization && <p className="w-full text-xs">{t(
              'Los colores de la partida están disponibles en el plan Event 24h.',
              'Event colors are available on the Event 24h plan.',
            )}</p>}
          </fieldset>}
          {section !== 'questionnaire' && <fieldset disabled={!features.advancedCustomization} className="space-y-2 rounded-xl border border-current/15 p-3">
            <legend className="px-1 text-sm font-medium">{t('Logo del formulario y cuestionario', 'Registration and questionnaire logo')}</legend>
            {!features.advancedCustomization && <p className="text-xs">{t('Disponible en el plan Event 24h.', 'Available on the Event 24h plan.')}</p>}
            <MediaPicker selectLabel={t('Logo guardado', 'Saved logo')} uploadLabel={t('Subir logo', 'Upload logo')}
              libraryLabel={t('Abrir biblioteca de logos', 'Open logo library')} emptyLabel={t('Sin logo', 'No logo')}
              value={config.logoKey ?? ''} accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              hint={t('PNG, JPG, WebP, GIF o SVG hasta 5 MB.', 'PNG, JPG, WebP, GIF or SVG up to 5 MB.')}
              options={[
                ...(config.logoKey && !logoLibrary.some(item => item.key === config.logoKey)
                  ? [{ value: config.logoKey, label: t('Logo actual', 'Current logo') }] : []),
                ...logoLibrary.map(item => ({ value: item.key, label: item.name || item.fileName })),
              ]}
              onSelect={value => changeConfig({ logoKey: value || null })}
              onOpenLibrary={() => void run(async () => { setLogoLibrary((await fetchUserMedia()).logo.items) })}
              onUpload={file => {
                void run(async () => {
                  if (!file.size || file.size > 5 * 1024 * 1024) {
                    throw new Error(t('El logo debe ocupar entre 1 byte y 5 MB.', 'The logo must be between 1 byte and 5 MB.'))
                  }
                  const uploaded = await uploadLibraryImage(file)
                  const items = (await fetchUserMedia()).logo.items
                  if (!items.some(item => item.key === uploaded.key && item.url)) {
                    throw new Error(t('No se pudo cargar el logo subido. Reabre la biblioteca para seleccionarlo.', 'Could not load the uploaded logo. Reopen the library to select it.'))
                  }
                  setLogoLibrary(items)
                  changeConfig({ logoKey: uploaded.key })
                })
              }} />
          </fieldset>}
          {(!section || section === 'registration') && <fieldset className="space-y-1 rounded-xl border border-current/15 p-3 text-sm">
            <legend className="px-1 font-medium">{t('Campos de registro', 'Registration fields')}</legend>
            {[
              t('Email', 'Email'), t('Nombre completo', 'Full name'), t('Teléfono', 'Phone'),
            ].map(label => <label key={label} className="flex min-h-[28px] items-center gap-2">
              <input type="checkbox" checked disabled />
              {label} {t('(obligatorio)', '(required)')}
            </label>)}
            <div className="border-t border-current/15" />
            <label className="flex min-h-[28px] items-center gap-2">
              <input type="checkbox" checked={draft.participantFields.profilePhoto?.enabled === true}
                onChange={event => setDraft({ ...draft, participantFields: {
                  ...resolveParticipantFields(draft.participantFields), profilePhoto: { enabled: event.target.checked },
                } })} />
              {t('Foto de perfil', 'Profile photo')} {t('(opcional)', '(optional)')}
            </label>
            {OPTIONAL_REGISTRATION_FIELDS.map(field => <label key={field.key} className="flex min-h-[28px] items-center gap-2">
              <input type="checkbox" checked={draft.participantFields[field.key]?.enabled === true}
                onChange={event => setDraft({ ...draft, participantFields: {
                  ...resolveParticipantFields(draft.participantFields), [field.key]: { enabled: event.target.checked },
                } })} />
              {t(field.es, field.en)} {t('(opcional)', '(optional)')}
            </label>)}
          </fieldset>}
          {(!section || section === 'questionnaire') && <fieldset className="space-y-3 rounded-xl border border-current/15 p-3">
            <legend className="px-1 font-medium">{t('Cuestionario', 'Questionnaire')}</legend>
            <label className="block text-sm">{t('Momento del cuestionario', 'Questionnaire timing')}
              <select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"
                disabled={!features.playerForms && confirmed.formConfig.quizMoment === 'disabled'}
                value={config.quizMoment} onChange={event => changeConfig({ quizMoment: event.target.value as GameFormConfig['quizMoment'] })}>
                {momentLabels.map(([value, label]) => <option key={value} value={value}
                  disabled={(value === 'after_game' && ['INFOCARDS', 'IMPOSTOR'].includes(confirmed.gameType))
                    || (value !== 'disabled' && (
                      (!features.playerForms && value !== confirmed.formConfig.quizMoment)
                      || (confirmed.locked && value !== (confirmed.formConfig.quizMoment === 'disabled'
                        ? confirmed.quizPreviousMoment : confirmed.formConfig.quizMoment))
                    ))}>{label}</option>)}
              </select>
            </label>
            {['INFOCARDS', 'IMPOSTOR'].includes(confirmed.gameType) && <p className="text-xs">
              {t('Este juego no tiene un final individual verificable. El cuestionario después del juego no está disponible.', 'This game has no verifiable individual finish. The after-game questionnaire is unavailable.')}
            </p>}
            <p className="text-xs">{t('Hasta 5 preguntas, 3 opciones por pregunta y una sola respuesta. Sin puntuación.', 'Up to 5 questions, 3 options each and a single answer. No scoring.')}</p>
            <fieldset disabled={confirmed.locked || !features.playerForms} className="space-y-3">
            {draft.questions.map((question, index) => <fieldset key={question.id} className="space-y-2 border-t border-current/15 pt-3">
              <legend className="text-sm font-medium">{t('Pregunta', 'Question')} {index + 1}</legend>
              <label className="block text-sm">{t('Texto de la pregunta', 'Question text')} {index + 1}
                <input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"
                  maxLength={500}
                  value={question.text} onChange={event => updateQuestion(index, { text: event.target.value })} />
              </label>
              {question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-end gap-2">
                <label className="flex-1 text-sm">{t('Opción', 'Option')} {index + 1}.{optionIndex + 1}
                  <input className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2" value={option.title} maxLength={200}
                    onChange={event => updateQuestion(index, { options: question.options.map((item, i) => i === optionIndex ? { ...item, title: event.target.value } : item) })} />
                </label>
                <button type="button" className="p-2 text-sm underline" aria-label={`${t('Eliminar opción', 'Remove option')} ${index + 1}.${optionIndex + 1}`}
                  onClick={() => updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })}>×</button>
              </div>)}
              <div className="flex flex-wrap gap-3 text-sm">
                <button type="button" className="underline" disabled={question.options.length >= 3}
                  onClick={() => {
                    const payload = ['a', 'b', 'c'].map(letter => `${gameId}_${question.id}_${letter}`)
                      .find(payload => !question.options.some(option => option.payload === payload))!
                    updateQuestion(index, { options: [...question.options, { title: '', payload }] })
                  }}>
                  {t('Añadir opción', 'Add option')} {index + 1}
                </button>
                <button type="button" className="underline"
                  onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>
                  {t('Eliminar pregunta', 'Remove question')} {index + 1}
                </button>
              </div>
            </fieldset>)}
            <button type="button" className="underline" disabled={draft.questions.length >= 5}
              onClick={() => {
                const id = ['q1', 'q2', 'q3', 'q4', 'q5'].find(id => !draft.questions.some(question => question.id === id))!
                setDraft({ ...draft, questions: [...draft.questions, { id, text: '',
                  options: [{ title: '', payload: `${gameId}_${id}_a` }, { title: '', payload: `${gameId}_${id}_b` }] }] })
              }}>
              {t('Añadir pregunta', 'Add question')}
            </button>
            </fieldset>
          </fieldset>}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-4">
          {dirty && <p className="text-xs">{t('Cambios sin guardar', 'Unsaved changes')}</p>}
          <div className="ml-auto flex gap-2">
            {(!section || section === 'questionnaire') && <IconButton icon="download" className="!h-11 !w-11"
              label={t('Exportar respuestas', 'Export answers')} disabled={busy || !features.exportResults}
              onClick={() => void run(async () => {
                const result = await exportFormResults(gameId)
                const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = `quiz-data-${gameId}.json`
                anchor.click()
                URL.revokeObjectURL(url)
              })} />}
            <IconButton icon="reload" className="!h-11 !w-11" label={t('Recargar formulario', 'Reload form')} disabled={busy}
              onClick={() => dirty ? setDiscardReload(true) : setReload(value => value + 1)} />
            <SaveButton iconOnly disabled={disabled || !dirty} onClick={save}>
              {section === 'questionnaire' ? t('Guardar cuestionario', 'Save questionnaire') : t('Guardar formulario', 'Save form')}
            </SaveButton>
          </div>
        </div>
        {discardReload && <div role="alertdialog" aria-label={t('Recargar formulario', 'Reload form')} className="space-y-3 rounded-xl border border-current/20 p-4">
          <p>{t('Recargar descartará los cambios sin guardar.', 'Reloading will discard unsaved changes.')}</p>
          <button type="button" disabled={busy} className="mr-4 underline" onClick={() => { setDiscardReload(false); setReload(value => value + 1) }}>
            {t('Recargar y descartar', 'Reload and discard')}
          </button>
          <button type="button" className="underline" onClick={() => setDiscardReload(false)}>{t('Seguir editando', 'Keep editing')}</button>
        </div>}
      </div>
      <aside className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(92dvh-13rem)] lg:self-start lg:overflow-hidden"
        aria-label={t('Vista previa del formulario', 'Form preview')}>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-current/15 p-3">
          <QRCode data={confirmed.joinUrl} size={80} margin={4} alt={t('QR de participación', 'Participant QR code')} className="!bg-white !p-1" />
          <a className="min-w-0 break-all text-sm underline" href={confirmed.joinUrl} target="_blank" rel="noreferrer">{t('Abrir enlace de participación', 'Open participant link')}</a>
        </div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('Vista previa', 'Preview')}</h3>
          {!section && <div role="tablist" aria-label={t('Vista previa', 'Preview')} className="flex gap-2 text-sm">
            {(['registration', 'quiz'] as const).map(section => <button key={section} type="button" role="tab"
              id={`form-preview-tab-${section}`} aria-controls="form-preview-panel" aria-selected={preview === section}
              className={`rounded-lg px-3 py-2 ${preview === section ? 'bg-primary/20 font-semibold' : ''}`}
              onClick={() => setPreview(section)}>{section === 'registration' ? t('Registro', 'Registration') : t('Cuestionario', 'Questionnaire')}</button>)}
          </div>}
        </div>
        <article role={section ? 'region' : 'tabpanel'} id="form-preview-panel"
          aria-labelledby={!section ? `form-preview-tab-${preview}` : undefined}
          aria-label={section ? t('Vista previa', 'Preview') : undefined}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <ParticipantPhonePreview gameType={confirmed.gameType} screen="form" language={defaultLanguage}
            label={t('Vista en el móvil del participante', 'Participant phone view')} {...frame} prizeCatalog={prizeCatalog}>
            {preview === 'registration' ? <JoinForm preview gameId={gameId} onJoined={() => undefined} gameMeta={{
              ok: true, gameId, gameType: confirmed.gameType, isActive: true,
              playerCount: 0, validatedCount: 0, recentPairs: [], joinUrl: confirmed.joinUrl,
              participantFields: resolveParticipantFields(draft.participantFields),
              formConfig: { ...config, registrationTitle: config.registrationTitle || (defaultLanguage === 'en' ? 'Join in' : 'Participa') },
              formLogoUrl: frame.logoUrl, formBannerUrl: frame.bannerUrl,
              loyalty: confirmed.loyalty, prizeCatalog,
            }} /> : <QuizCard title={config.quizTitle || undefined}
              description={config.quizDescription} logoUrl={frame.logoUrl} bannerUrl={frame.bannerUrl}
              questions={draft.questions} answers={answers} namePrefix="form-preview"
              onChange={(id, value) => setAnswers(current => ({ ...current, [id]: value }))} />}
          </ParticipantPhonePreview>
        </article>
        <p className="text-xs">{t('La vista previa no registra participantes ni envía respuestas. El enlace muestra la versión guardada.', 'Preview does not register participants or submit answers. The link shows the saved version.')}</p>
      </aside>
    </div>}
  </div>
}
