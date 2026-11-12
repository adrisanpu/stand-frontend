import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { exportFormResults, generateFormQuestions, getGameForm, saveGameForm } from '../../api/gameForms'
import { fetchUserMedia, uploadLibraryImage, type UserMediaItem } from '../../api/userMedia'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { formDraft, validateFormDraft, type GameFormConfig, type GameFormDraft, type GameFormResponse } from '../formConfig'
import { FormHeader, QuizFields } from '../participant/FormPresentation'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import QRCode from '../widgets/QRCode'
import HomeCanvasEditor from '../home/HomeCanvasEditor'
import JoinForm from '../participant/JoinForm'
import { ParticipantLanguageProvider } from '../participant/participantLanguage'
import { OPTIONAL_REGISTRATION_FIELDS, resolveParticipantFields } from '../lib/participantFields'

export default function GameFormSettings({ gameId, gameName, readOnly = false, section, onDirtyChange, onBusyChange, onReadyChange, onSectionDirtyChange }: {
  gameId: string
  gameName?: string
  readOnly?: boolean
  section?: 'appearance' | 'registration' | 'questionnaire'
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
  onReadyChange?: (section: 'appearance' | 'registration' | 'questionnaire', ready: boolean) => void
  onSectionDirtyChange?: (section: 'appearance' | 'registration' | 'questionnaire', dirty: boolean) => void
}) {
  const { language, t } = useOperatorLanguage()
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
  const [generationText, setGenerationText] = useState('')
  const [generationCount, setGenerationCount] = useState(3)
  const [logoLibrary, setLogoLibrary] = useState<UserMediaItem[]>([])
  const [canvasDirty, setCanvasDirty] = useState(false)
  const [canvasMounted, setCanvasMounted] = useState(section === 'appearance')
  useEffect(() => { if (section === 'appearance') setCanvasMounted(true) }, [section])
  const dirty = !!draft && !!confirmed && JSON.stringify(draft) !== JSON.stringify(formDraft(confirmed))
  const callbacks = useRef({ onBusyChange, onDirtyChange, onReadyChange, onSectionDirtyChange })
  callbacks.current = { onBusyChange, onDirtyChange, onReadyChange, onSectionDirtyChange }
  useEffect(() => { callbacks.current.onDirtyChange?.(dirty || canvasDirty) }, [dirty, canvasDirty])
  useEffect(() => {
    if (!draft || !confirmed) return
    const saved = formDraft(confirmed)
    callbacks.current.onSectionDirtyChange?.('appearance', canvasDirty)
    callbacks.current.onSectionDirtyChange?.('registration',
      draft.formConfig.registrationTitle !== saved.formConfig.registrationTitle
      || draft.formConfig.registrationDescription !== saved.formConfig.registrationDescription
      || draft.formConfig.logoKey !== saved.formConfig.logoKey
      || JSON.stringify(draft.participantFields) !== JSON.stringify(saved.participantFields))
    callbacks.current.onSectionDirtyChange?.('questionnaire',
      draft.formConfig.quizTitle !== saved.formConfig.quizTitle
      || draft.formConfig.quizDescription !== saved.formConfig.quizDescription
      || draft.formConfig.logoKey !== saved.formConfig.logoKey
      || draft.formConfig.quizMoment !== saved.formConfig.quizMoment
      || JSON.stringify(draft.questions) !== JSON.stringify(saved.questions))
  }, [draft, confirmed, canvasDirty])
  useEffect(() => {
    const ready = !!draft && !!confirmed && !busy && !dirty && !error && !uncertain
      && !validateFormDraft(draft, confirmed.questions)
    callbacks.current.onReadyChange?.('registration', ready)
    callbacks.current.onReadyChange?.('questionnaire', ready)
  }, [draft, confirmed, busy, dirty, error, uncertain])
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
    <button type="button" disabled={busy} className="underline" onClick={() => setReload(value => value + 1)}>
      {t('Recargar formulario', 'Reload form')}
    </button>
  </div>

  const config = draft.formConfig
  const imageUrl = (kind: 'logo' | 'banner') => kind === 'logo'
    ? config.logoKey
      ? logoLibrary.find(item => item.key === config.logoKey)?.url
        ?? (config.logoKey === confirmed.formConfig.logoKey ? confirmed.logoUrl : null)
      : null
    : confirmed.bannerUrl
  const dark = config.appearance?.themeMode === 'dark'
  const appearanceStyle = {
    backgroundColor: dark ? '#152F3A' : '#FFFFFF',
    color: dark ? '#F0F3EF' : '#152F3A',
    ...(config.appearance?.colors ? {
      '--color-primary': config.appearance.colors.primary,
      '--color-accent': config.appearance.colors.accent,
    } : {}),
  } as CSSProperties
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
    {(!section || section === 'questionnaire') && confirmed.locked && <p role="status">{t('Ya hay respuestas: las preguntas y el momento del cuestionario están bloqueados. Puedes editar la presentación.', 'Responses exist: questions and questionnaire timing are locked. Presentation is still editable.')}</p>}
    {section && section !== 'appearance' && <p className="text-xs">{t('Guardar aplica los cambios pendientes de registro y cuestionario. El lienzo del Home se guarda por separado en Home.', 'Saving applies pending registration and questionnaire changes. The Home canvas is saved separately in Home.')}</p>}
    {canvasMounted && <div hidden={section !== 'appearance'}>
      <HomeCanvasEditor gameId={gameId} gameName={gameName ?? gameId} appearance={config.appearance}
        logoSrc={imageUrl('logo')} advanced={features.advancedCustomization}
        readOnly={readOnly || confirmed.readOnly || uncertain} onDirtyChange={setCanvasDirty}
        onReadyChange={ready => callbacks.current.onReadyChange?.('appearance', ready && !busy && !uncertain)}
        onBusyChange={value => {
          canvasBusy.current = value
          callbacks.current.onBusyChange?.(value || busyRef.current)
        }} />
    </div>}
    {section !== 'appearance' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <fieldset disabled={disabled} className="space-y-4">
          <legend className="mb-3 text-lg font-semibold">{t('Contenido', 'Content')}</legend>
          <fieldset disabled={!features.advancedCustomization} className="space-y-2 rounded-xl border border-current/15 p-3">
            <legend className="px-1 text-sm font-medium">{t('Logo del formulario y cuestionario', 'Registration and questionnaire logo')}</legend>
            {!features.advancedCustomization && <p className="text-xs">{t('Disponible en el plan Event 24h.', 'Available on the Event 24h plan.')}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">{t('Logo guardado', 'Saved logo')}</span>
                <select className="w-full rounded-lg border border-current/20 bg-transparent p-2" value={config.logoKey ?? ''}
                  onChange={event => changeConfig({ logoKey: event.target.value || null })}>
                  <option value="">{t('Sin logo', 'No logo')}</option>
                  {config.logoKey && !logoLibrary.some(item => item.key === config.logoKey) &&
                    <option value={config.logoKey}>{t('Logo actual', 'Current logo')}</option>}
                  {logoLibrary.map(item => <option key={item.id} value={item.key}>{item.name || item.fileName}</option>)}
                </select>
              </label>
              <button type="button" className="min-h-[36px] text-sm underline"
                onClick={() => void run(async () => { setLogoLibrary((await fetchUserMedia()).logo.items) })}>
                {t('Abrir biblioteca de logos', 'Open logo library')}
              </button>
            </div>
            <label className="block text-sm">{t('Subir logo', 'Upload logo')}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="mt-1 block w-full text-xs"
                onChange={event => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
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
            </label>
          </fieldset>
          {([
            ['registrationTitle', t('Título del registro', 'Registration title')],
            ['registrationDescription', t('Descripción del registro', 'Registration description')],
            ['quizTitle', t('Título del cuestionario', 'Questionnaire title')],
            ['quizDescription', t('Descripción del cuestionario', 'Questionnaire description')],
          ] as const).filter(([key]) => !section || key.startsWith(section === 'registration' ? 'registration' : 'quiz'))
            .map(([key, label]) => <label key={key} className="block space-y-1 text-sm">
            <span>{label}</span>
            {key.endsWith('Description')
              ? <textarea className="w-full rounded-lg border border-current/20 bg-transparent p-2" rows={3}
                maxLength={1000}
                value={config[key]} onChange={event => changeConfig({ [key]: event.target.value })} />
              : <input className="w-full rounded-lg border border-current/20 bg-transparent p-2"
                maxLength={160}
                value={config[key]} onChange={event => changeConfig({ [key]: event.target.value })} />}
          </label>)}
          {(!section || section === 'registration') && <fieldset className="space-y-1 rounded-xl border border-current/15 p-3 text-sm">
            <legend className="px-1 font-medium">{t('Campos de registro', 'Registration fields')}</legend>
            {[
              t('Email', 'Email'), t('Nombre completo', 'Full name'), t('Teléfono', 'Phone'),
            ].map(label => <label key={label} className="flex min-h-[28px] items-center gap-2">
              <input type="checkbox" checked disabled />
              {label} {t('(obligatorio)', '(required)')}
            </label>)}
            <div className="border-t border-current/15" />
            {OPTIONAL_REGISTRATION_FIELDS.map(field => <label key={field.key} className="flex min-h-[28px] items-center gap-2">
              <input type="checkbox" checked={draft.participantFields[field.key]?.enabled === true}
                onChange={event => setDraft({ ...draft, participantFields: {
                  ...resolveParticipantFields(draft.participantFields), [field.key]: { enabled: event.target.checked },
                } })} />
              {t(field.es, field.en)} {t('(opcional)', '(optional)')}
            </label>)}
          </fieldset>}
          {(!section || section === 'questionnaire') && <fieldset disabled={confirmed.locked || !features.playerForms} className="space-y-3 rounded-xl border border-current/15 p-3">
            <legend className="px-1 font-medium">{t('Cuestionario', 'Questionnaire')}</legend>
            <label className="block text-sm">{t('Momento del cuestionario', 'Questionnaire timing')}
              <select className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"
                value={config.quizMoment} onChange={event => changeConfig({ quizMoment: event.target.value as GameFormConfig['quizMoment'] })}>
                {momentLabels.map(([value, label]) => <option key={value} value={value}
                  disabled={value === 'after_game' && ['INFOCARDS', 'IMPOSTOR'].includes(confirmed.gameType)}>{label}</option>)}
              </select>
            </label>
            {['INFOCARDS', 'IMPOSTOR'].includes(confirmed.gameType) && <p className="text-xs">
              {t('Este juego no tiene un final individual verificable. El cuestionario después del juego no está disponible.', 'This game has no verifiable individual finish. The after-game questionnaire is unavailable.')}
            </p>}
            <p className="text-xs">{t('Hasta 5 preguntas, 3 opciones por pregunta y una sola respuesta. Sin puntuación.', 'Up to 5 questions, 3 options each and a single answer. No scoring.')}</p>
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
            <details className="space-y-3 border-t border-current/15 pt-3">
              <summary className="cursor-pointer text-sm">{t('Generar borrador con IA', 'Generate an AI draft')}</summary>
              <label className="block text-sm">{t('Tema del cuestionario', 'Questionnaire topic')}
                <textarea className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-2"
                  value={generationText} onChange={event => setGenerationText(event.target.value)} />
              </label>
              <label className="block text-sm">{t('Número de preguntas', 'Number of questions')}
                <select className="ml-2 rounded border border-current/20 bg-transparent p-2" value={generationCount}
                  onChange={event => setGenerationCount(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5].map(count => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
              <p className="text-xs">{t('Reemplaza las preguntas del borrador; no guarda ni reinicia participantes.', 'Replaces draft questions; does not save or reset participants.')}</p>
              <button type="button" className="underline" disabled={!generationText.trim()} onClick={() => void run(async () => {
                const questions = await generateFormQuestions(gameId, { text: generationText.trim(),
                  numQuestions: generationCount, numOptions: 3, useEmojis: false })
                setDraft(current => current ? { ...current, questions } : current)
                setStatus(t('Borrador generado. Revisa las preguntas y guarda explícitamente.', 'Draft generated. Review the questions and save explicitly.'))
              })}>{t('Generar preguntas', 'Generate questions')}</button>
            </details>
          </fieldset>}
        </fieldset>
      </div>
      <aside className="flex min-w-0 flex-col gap-4" aria-label={t('Vista previa del formulario', 'Form preview')}>
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
          className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-current/20 p-5 shadow-sm" style={appearanceStyle}>
          {preview === 'registration' ? <ParticipantLanguageProvider key={language} initialLanguage={language}>
            <JoinForm preview gameId={gameId} onJoined={() => undefined} gameMeta={{
              ok: true, gameId, gameType: confirmed.gameType, isActive: true,
              playerCount: 0, validatedCount: 0, recentPairs: [], joinUrl: confirmed.joinUrl,
              participantFields: resolveParticipantFields(draft.participantFields),
              formConfig: { ...config, registrationTitle: config.registrationTitle || t('Participa', 'Join in') },
              formLogoUrl: imageUrl('logo'), formBannerUrl: imageUrl('banner'),
              loyalty: confirmed.loyalty,
            }} />
          </ParticipantLanguageProvider> : <div className="space-y-3">
            <FormHeader title={config.quizTitle || t('Cuestionario', 'Questionnaire')}
              description={config.quizDescription} logoUrl={imageUrl('logo')} bannerUrl={imageUrl('banner')} />
            {config.quizMoment === 'disabled' && <p className="text-sm">{t('Cuestionario desactivado; esta vista es solo una prueba.', 'Questionnaire disabled; this is only a preview.')}</p>}
            <QuizFields questions={draft.questions} answers={answers} onChange={(id, value) => setAnswers(current => ({ ...current, [id]: value }))} namePrefix="form-preview" />
          </div>}
        </article>
        <p className="text-xs">{t('La vista previa no registra participantes ni envía respuestas. El enlace muestra la versión guardada.', 'Preview does not register participants or submit answers. The link shows the saved version.')}</p>
        <div className="mt-auto pt-12">
        <div className="flex items-center gap-3 rounded-xl border border-current/15 p-3">
          <QRCode data={confirmed.joinUrl} size={80} margin={4} alt={t('QR de participación', 'Participant QR code')} className="!bg-white !p-1" />
          <a className="min-w-0 break-all text-sm underline" href={confirmed.joinUrl} target="_blank" rel="noreferrer">{t('Abrir enlace de participación', 'Open participant link')}</a>
        </div>
        </div>
      </aside>
    </div>}
    {section !== 'appearance' && <>
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-4">
      <p className="text-xs">{dirty ? t('Cambios sin guardar', 'Unsaved changes') : t('Sin cambios pendientes', 'No pending changes')} · {t('Revisión', 'Revision')}: {confirmed.revision}</p>
      <div className="flex gap-3">
        {(!section || section === 'questionnaire') && <button type="button" disabled={busy || !features.exportResults} className="rounded-lg border border-current/20 px-3 py-2"
          onClick={() => void run(async () => {
            const result = await exportFormResults(gameId)
            const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `quiz-data-${gameId}.json`
            anchor.click()
            URL.revokeObjectURL(url)
          })}>{t('Exportar respuestas', 'Export answers')}</button>}
        <button type="button" disabled={busy} className="rounded-lg border border-current/20 px-3 py-2"
          onClick={() => dirty ? setDiscardReload(true) : setReload(value => value + 1)}>{t('Recargar formulario', 'Reload form')}</button>
        <button type="button" disabled={disabled || !dirty} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50" onClick={save}>
          {busy ? t('Guardando…', 'Saving…') : section === 'questionnaire'
            ? t('Guardar cuestionario', 'Save questionnaire') : t('Guardar formulario', 'Save form')}
        </button>
      </div>
    </div>
    {discardReload && <div role="alertdialog" aria-label={t('Recargar formulario', 'Reload form')} className="space-y-3 rounded-xl border border-current/20 p-4">
      <p>{t('Recargar descartará los cambios sin guardar.', 'Reloading will discard unsaved changes.')}</p>
      <button type="button" disabled={busy} className="mr-4 underline" onClick={() => { setDiscardReload(false); setReload(value => value + 1) }}>
        {t('Recargar y descartar', 'Reload and discard')}
      </button>
      <button type="button" className="underline" onClick={() => setDiscardReload(false)}>{t('Seguir editando', 'Keep editing')}</button>
    </div>}
    </>}
  </div>
}
