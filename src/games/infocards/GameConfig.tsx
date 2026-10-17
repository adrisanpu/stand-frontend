import { useState, useEffect, useRef, useCallback } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'

type InfoCard = {
  id: string
  title: string
  body: string
  imageKey?: string | null
  videoKey?: string | null
  imageUrl?: string | null   // presigned GET URL from backend, not persisted
  videoUrl?: string | null   // presigned GET URL from backend, not persisted
  order?: number
  imagePositionX?: number   // 0-100, focal point for object-position
  imagePositionY?: number
  _localImagePreview?: string  // blob URL for immediate preview before save
  _localVideoPreview?: string
}

type UploadUrlResponse = {
  ok: boolean
  gameId: string
  uploadUrls: Array<{ key: string; url: string; fields: Record<string, string>; fileName: string; expiresIn: number }>
}

type GetResponse = {
  ok: boolean
  gameId: string
  cards: InfoCard[]
  requiresValidation?: boolean
  quizCompletedMessage?: string
}

type ProcessResponse = {
  ok: boolean
  gameId: string
  cards: InfoCard[]
  quizGenerated: boolean
}

type PutResponse = {
  ok: boolean
  gameId: string
  cardsCount: number
}

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export type CardLayoutPosition = 'top' | 'left' | 'right' | 'bottom'

const LAYOUT_OPTIONS: { value: CardLayoutPosition; label: string }[] = [
  { value: 'top', label: 'Arriba' },
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
  { value: 'bottom', label: 'Abajo' },
]

export default function InfocardsGameConfig({ gameId, settings = {}, onChange, registerSave }: GameConfigProps) {
  // Section A — current cards
  const [cards, setCards] = useState<InfoCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [cardsLoadError, setCardsLoadError] = useState('')
  const [cardsDirty, setCardsDirty] = useState(false)
  const savedCardLayouts = settings?.cardLayouts as Record<string, CardLayoutPosition> | undefined
  const [cardLayouts, setCardLayouts] = useState<Record<string, CardLayoutPosition>>(savedCardLayouts ?? {})
  const [layoutsDirty, setLayoutsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Status>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [mediaUploadingCardId, setMediaUploadingCardId] = useState<string | null>(null)

  // Section B — AI generation
  const [aiExpanded, setAiExpanded] = useState(false)
  const [text, setText] = useState('')
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [numCards, setNumCards] = useState(6)
  const [generateQuiz, setGenerateQuiz] = useState(false)
  const [numQuestions, setNumQuestions] = useState(3)
  const [numOptions, setNumOptions] = useState(3)
  const [useEmojis, setUseEmojis] = useState(false)
  const [aiStatus, setAiStatus] = useState<Status>('idle')
  const [aiMessage, setAiMessage] = useState('')

  // Participation / sorteo (no validación, mensaje al completar quiz)
  const [requiresValidation, setRequiresValidation] = useState(false)
  const [quizCompletedMessage, setQuizCompletedMessage] = useState('')

  const pdfInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const mediaInputCardIdRef = useRef<string | null>(null)
  const focalContainerRef = useRef<Record<string, HTMLDivElement | null>>({})
  const draggingFocalCardIdRef = useRef<string | null>(null)

  const fetchCards = useCallback(async () => {
    if (!gameId) return
    setLoadingCards(true)
    setCardsLoadError('')
    try {
      const data = await api.get<GetResponse>(`/v1/game/infocards?gameId=${encodeURIComponent(gameId)}`)
      const sorted = (data.cards || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setCards(sorted)
      setCardsDirty(false)
      setAiExpanded(sorted.length === 0)
      setRequiresValidation(data.requiresValidation ?? false)
      setQuizCompletedMessage(data.quizCompletedMessage ?? '')
    } catch (err) {
      setCards([])
      setAiExpanded(true)
      setCardsLoadError(saveErrorMessage(err, 'No se pudieron cargar las tarjetas.'))
    } finally {
      setLoadingCards(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  useEffect(() => {
    setCardLayouts(savedCardLayouts ?? {})
    setLayoutsDirty(false)
  }, [savedCardLayouts])

  // ===== Per-card media upload =====

  const handleMediaClick = (cardId: string) => {
    if (mediaUploadingCardId) return
    mediaInputCardIdRef.current = cardId
    mediaInputRef.current?.click()
  }

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !mediaInputCardIdRef.current) return

    const cardId = mediaInputCardIdRef.current
    mediaInputCardIdRef.current = null
    if (mediaInputRef.current) mediaInputRef.current.value = ''

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return

    setMediaUploadingCardId(cardId)
    setSaveStatus('idle')

    try {
      const uploadRes = await api.post<UploadUrlResponse>('/v1/game/infocards/upload-url', {
        gameId,
        files: [{ fileName: file.name, contentType: file.type, sizeBytes: file.size }],
      })

      if (!uploadRes.ok || !uploadRes.uploadUrls?.[0]) {
        throw new Error('No se pudo obtener URL de subida.')
      }

      const { key, url, fields } = uploadRes.uploadUrls[0]
      const form = new FormData()
      Object.entries(fields).forEach(([field, value]) => form.append(field, value))
      form.append('file', file)
      const uploadResponse = await fetch(url, { method: 'POST', body: form })
      if (!uploadResponse.ok) throw new Error(`Error al subir archivo (${uploadResponse.status})`)

      const localPreview = URL.createObjectURL(file)
      setCards(prev => prev.map(c => {
        if (c.id !== cardId) return c
        if (isImage) return { ...c, imageKey: key, _localImagePreview: localPreview }
        return { ...c, videoKey: key, _localVideoPreview: localPreview }
      }))
      setCardsDirty(true)
    } catch (err) {
      setSaveStatus('error')
      setSaveMessage(err instanceof Error ? err.message : 'Error al subir archivo.')
    } finally {
      setMediaUploadingCardId(null)
    }
  }

  const handleRemoveMedia = (cardId: string, type: 'image' | 'video') => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c
      if (type === 'image') return { ...c, imageKey: null, imageUrl: null, _localImagePreview: undefined }
      return { ...c, videoKey: null, videoUrl: null, _localVideoPreview: undefined }
    }))
    setCardsDirty(true)
  }

  const isAiLoading = aiStatus === 'uploading' || aiStatus === 'processing'
  const isSaving = saveStatus === 'uploading'

  const validate = () => {
    if (mediaUploadingCardId) return 'Espera a que termine la subida del archivo.'
    if (isAiLoading) return 'Espera a que termine la generación con IA.'
    if (loadingCards && gameId) return 'Las tarjetas aún se están cargando.'
    if (cardsDirty && cardsLoadError) return cardsLoadError
    return null
  }

  const persist = async () => {
    const invalid = validate()
    if (invalid) throw new Error(invalid)
    if (cardsDirty && gameId) {
      // Strip ephemeral/computed fields before sending
      const cardsToSave = cards.map(({ _localImagePreview, _localVideoPreview, imageUrl, videoUrl, ...rest }) => rest)
      const res = await api.put<PutResponse>('/v1/game/infocards', {
        gameId,
        cards: cardsToSave,
        requiresValidation,
        quizCompletedMessage: quizCompletedMessage.trim(),
      })
      if (!res?.ok) throw new Error('No se pudieron guardar las tarjetas.')
      await fetchCards()
    }
    setLayoutsDirty(false)
    onChange({ ...settings, cardLayouts, refreshGameScreen: true })
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const handleSaveCards = async () => {
    if (!gameId) return
    setSaveStatus('uploading')
    setSaveMessage('Guardando...')
    try {
      await persist()
      setSaveStatus('done')
      setSaveMessage('Guardado correctamente.')
    } catch (err) {
      setSaveStatus('error')
      setSaveMessage(saveErrorMessage(err, 'Error al guardar.'))
    }
  }

  // ===== AI generation =====

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf')
    setPdfFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...selected.filter(f => !existing.has(f.name + f.size))]
    })
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  const handleGenerate = async () => {
    if (!gameId) return
    if (!text.trim() && pdfFiles.length === 0) {
      setAiStatus('error')
      setAiMessage('Añade texto o un PDF antes de generar.')
      return
    }

    setAiStatus('uploading')
    setAiMessage('Subiendo archivos...')

    let fileKeys: string[] = []

    try {
      if (pdfFiles.length > 0) {
        const uploadRes = await api.post<UploadUrlResponse>('/v1/game/infocards/upload-url', {
          gameId,
          files: pdfFiles.map(f => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size })),
        })

        if (!uploadRes.ok || !uploadRes.uploadUrls) {
          throw new Error('No se pudieron obtener las URLs de subida.')
        }

        await Promise.all(
          uploadRes.uploadUrls.map(async ({ key, url, fields }, idx) => {
            const file = pdfFiles[idx]
            const form = new FormData()
            Object.entries(fields).forEach(([field, value]) => form.append(field, value))
            form.append('file', file)
            const res = await fetch(url, { method: 'POST', body: form })
            if (!res.ok) throw new Error(`Error al subir "${file.name}" (${res.status})`)
            fileKeys.push(key)
          })
        )
      }

      setAiStatus('processing')
      setAiMessage('Procesando con IA...')

      const processRes = await api.post<ProcessResponse>('/v1/game/infocards/process', {
        gameId,
        text: text.trim() || undefined,
        fileKeys: fileKeys.length > 0 ? fileKeys : undefined,
        numCards,
        generateQuiz,
        ...(generateQuiz ? { numQuestions, numOptions, useEmojis } : {}),
      })

      if (!processRes.ok) throw new Error('El procesamiento no se completó correctamente.')

      const newCards = (processRes.cards || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setCards(newCards)
      setCardsDirty(false)
      setAiStatus('done')
      setAiMessage(`Listo. Se generaron ${newCards.length} tarjetas.${processRes.quizGenerated ? ' Quiz generado.' : ''}`)
      setAiExpanded(false)
      onChange({ ...settings, processed: true, cardsCount: newCards.length, close: true })
    } catch (err) {
      setAiStatus('error')
      setAiMessage(err instanceof Error ? err.message : 'Error desconocido.')
    }
  }

  const getCardLayout = (cardId: string): CardLayoutPosition => cardLayouts[cardId] ?? 'top'

  const handleLayoutChangeForCard = (cardId: string, position: CardLayoutPosition) => {
    setCardLayouts(prev => ({ ...prev, [cardId]: position }))
    setLayoutsDirty(true)
  }

  const renderImageSlot = (card: InfoCard, className: string) => {
    const previewVideoSrc = card._localVideoPreview || card.videoUrl
    const previewImageSrc = card._localImagePreview || card.imageUrl
    const isUploadingThisCard = mediaUploadingCardId === card.id

    if (previewVideoSrc) {
      return (
        <div className={`relative flex-shrink-0 ${className}`}>
          <video
            src={previewVideoSrc}
            controls
            playsInline
            className="w-full h-full object-cover rounded-lg"
            aria-label={card.title}
          />
          <button
            onClick={() => handleRemoveMedia(card.id, 'video')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            aria-label="Eliminar vídeo"
          >
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )
    }

    if (previewImageSrc) {
      const posX = card.imagePositionX ?? 50
      const posY = card.imagePositionY ?? 50
      const handleFocalPointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        draggingFocalCardIdRef.current = card.id
        document.addEventListener('pointermove', focalMoveHandlerRef.current)
        document.addEventListener('pointerup', focalUpHandlerRef.current)
      }
      return (
        <div
          ref={el => { if (el) focalContainerRef.current[card.id] = el }}
          className={`relative flex-shrink-0 overflow-hidden rounded-lg ${className}`}
        >
          <img
            src={previewImageSrc}
            alt={card.title}
            className="w-full h-full object-cover rounded-lg"
            style={{ objectPosition: `${posX}% ${posY}%` }}
            draggable={false}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Ajustar encuadre de la imagen"
            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 shadow cursor-grab active:cursor-grabbing touch-none"
            style={{ left: `${posX}%`, top: `${posY}%` }}
            onPointerDown={handleFocalPointerDown}
          />
          <button
            onClick={() => handleRemoveMedia(card.id, 'image')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            aria-label="Eliminar imagen"
          >
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )
    }

    return (
      <button
        onClick={() => handleMediaClick(card.id)}
        disabled={!!mediaUploadingCardId}
        className={`rounded-lg border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 hover:border-white/30 transition-colors disabled:opacity-40 flex-shrink-0 ${className}`}
      >
        {isUploadingThisCard ? (
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] text-gray-600">Imagen / Vídeo</span>
          </>
        )}
      </button>
    )
  }

  const updateCardTitle = (cardId: string, title: string) => {
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, title } : c)))
    setCardsDirty(true)
  }
  const updateCardBody = (cardId: string, body: string) => {
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, body } : c)))
    setCardsDirty(true)
  }
  const updateCardImagePosition = (cardId: string, x: number, y: number) => {
    const cx = Math.max(0, Math.min(100, x))
    const cy = Math.max(0, Math.min(100, y))
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, imagePositionX: cx, imagePositionY: cy } : c)))
    setCardsDirty(true)
  }
  const updateCardImagePositionRef = useRef(updateCardImagePosition)
  updateCardImagePositionRef.current = updateCardImagePosition

  const focalMoveHandlerRef = useRef((e: PointerEvent) => {
    const cardId = draggingFocalCardIdRef.current
    if (!cardId) return
    const el = focalContainerRef.current[cardId]
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    updateCardImagePositionRef.current(cardId, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
  })
  const focalUpHandlerRef = useRef(() => {
    document.removeEventListener('pointermove', focalMoveHandlerRef.current)
    document.removeEventListener('pointerup', focalUpHandlerRef.current)
    draggingFocalCardIdRef.current = null
  })

  return (
    <div className="space-y-6">

      {/* ===== SECTION A: AI generation (first, Quiz-style) ===== */}
      <div>
        <button
          onClick={() => setAiExpanded(v => !v)}
          className="flex items-center justify-between w-full text-left mb-1 p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-expanded={aiExpanded}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            IA
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${aiExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {aiExpanded && (
          <div className="mt-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-3">
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="min-w-0">
                <label htmlFor="infocards-num-cards" className="block text-xs font-medium text-gray-400 mb-1">Nº de tarjetas</label>
                <select
                  id="infocards-num-cards"
                  value={numCards}
                  onChange={e => setNumCards(Number(e.target.value))}
                  disabled={isAiLoading}
                  className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none disabled:opacity-50"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none h-10 items-center pb-0.5">
                <input
                  type="checkbox"
                  checked={generateQuiz}
                  onChange={e => setGenerateQuiz(e.target.checked)}
                  disabled={isAiLoading}
                  className="rounded border-white/20 bg-[rgba(255,255,255,0.05)] text-indigo-500 focus:ring-white/20 disabled:opacity-50"
                />
                <span className="text-sm text-gray-300 whitespace-nowrap">Generar Quiz</span>
              </label>
              {generateQuiz && (
                <>
                  <div className="min-w-0">
                    <label htmlFor="infocards-num-questions" className="block text-xs font-medium text-gray-400 mb-1">Nº preguntas</label>
                    <select
                      id="infocards-num-questions"
                      value={numQuestions}
                      onChange={e => setNumQuestions(Number(e.target.value))}
                      disabled={isAiLoading}
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none disabled:opacity-50"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="infocards-num-options" className="block text-xs font-medium text-gray-400 mb-1">Nº respuestas</label>
                    <select
                      id="infocards-num-options"
                      value={numOptions}
                      onChange={e => setNumOptions(Number(e.target.value))}
                      disabled={isAiLoading}
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none disabled:opacity-50"
                    >
                      {[2, 3, 4].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10 items-center pb-0.5">
                    <input
                      type="checkbox"
                      checked={useEmojis}
                      onChange={e => setUseEmojis(e.target.checked)}
                      disabled={isAiLoading}
                      className="rounded border-white/20 bg-[rgba(255,255,255,0.05)] text-indigo-500 focus:ring-white/20 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-300 whitespace-nowrap">Emojis</span>
                  </label>
                </>
              )}
            </div>

            {/* Fila 2: Textarea 70% + Zona PDF 30% */}
            <div className="flex gap-3 min-h-[120px]">
              <div className="flex-[0_0_70%] min-w-0">
                <label className="block text-xs font-medium text-gray-400 mb-1">Descripción de tu producto o servicio</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Describe tu producto, servicio o marca aquí..."
                  rows={4}
                  disabled={isAiLoading}
                  className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none resize-none disabled:opacity-50 placeholder-gray-500"
                />
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isAiLoading && pdfInputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && !isAiLoading && pdfInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={e => {
                  e.preventDefault()
                  if (isAiLoading) return
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
                  if (files.length) {
                    setPdfFiles(prev => {
                      const existing = new Set(prev.map(f => f.name + f.size))
                      return [...prev, ...files.filter(f => !existing.has(f.name + f.size))]
                    })
                  }
                }}
                className="flex-[0_0_30%] min-w-0 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/15 cursor-pointer hover:border-white/25 transition-colors disabled:opacity-40 p-4"
              >
                <svg className="w-6 h-6 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs text-gray-400 text-center">Arrastra PDF aquí o clic</span>
                <input
                  ref={pdfInputRef}
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  disabled={isAiLoading}
                  className="hidden"
                />
              </div>
            </div>

            {pdfFiles.length > 0 && (
              <ul className="space-y-1">
                {pdfFiles.map((f, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/5 text-sm">
                    <span className="truncate text-gray-400 mr-2">{f.name}</span>
                    <button
                      onClick={() => setPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                      disabled={isAiLoading}
                      className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-50"
                      aria-label={`Eliminar ${f.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {cards.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-amber-500/10 border border-amber-500/20">
                <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-amber-400">
                  Reemplazará las {cards.length} tarjetas actuales.
                </p>
              </div>
            )}

            {aiStatus !== 'idle' && (
              <div className={`rounded-xl px-3 py-2.5 text-sm ${
                aiStatus === 'error'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : aiStatus === 'done'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
              }`}>
                {isAiLoading && (
                  <span className="inline-block w-3 h-3 rounded-full bg-current animate-pulse mr-2 align-middle" />
                )}
                {aiMessage}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isAiLoading || (!text.trim() && pdfFiles.length === 0)}
              className="w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#6366F1', color: '#fff' }}
            >
              {isAiLoading ? (aiStatus === 'uploading' ? 'Subiendo...' : 'Procesando...') : 'Generar tarjetas'}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* ===== SECTION: Participación y sorteo ===== */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Participación y sorteo</h3>
        <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!requiresValidation}
              onChange={e => {
                setRequiresValidation(!e.target.checked)
                setCardsDirty(true)
              }}
              className="rounded border-white/20 bg-[rgba(255,255,255,0.05)] text-indigo-500 focus:ring-white/20"
            />
            <span className="text-sm text-gray-300">No requiere validación (solo quiz para participar)</span>
          </label>
          <p className="text-xs text-gray-500">
            Si está activado, los jugadores no reciben código de validación; al completar el quiz se les envía el mensaje de abajo.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Mensaje al completar el quiz</label>
            <textarea
              value={quizCompletedMessage}
              onChange={e => {
                setQuizCompletedMessage(e.target.value)
                setCardsDirty(true)
              }}
              placeholder="¡Gracias! Ya estás participando en el sorteo."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none resize-none placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* ===== SECTION B: Vista previa (tarjetas actuales) ===== */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Vista previa</h3>

        {cardsLoadError && <p role="alert" className="mb-3 text-sm text-red-400">{cardsLoadError}</p>}
        {loadingCards ? (
          <p className="text-sm text-gray-400 animate-pulse">Cargando tarjetas...</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay tarjetas. Despliega IA arriba para generarlas.</p>
        ) : (
          <div className="space-y-3">
            {cards.map(card => {
              const layout = getCardLayout(card.id)
              const textBlock = (
                <div className="space-y-1.5">
                  <input
                    value={card.title}
                    onChange={e => updateCardTitle(card.id, e.target.value)}
                    placeholder="Título"
                    className="w-full px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm font-semibold text-textMain focus:border-white/20 focus:outline-none placeholder-gray-500"
                  />
                  <textarea
                    value={card.body}
                    onChange={e => updateCardBody(card.id, e.target.value)}
                    placeholder="Cuerpo de la tarjeta"
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-xs text-textSub leading-relaxed focus:border-white/20 focus:outline-none resize-none placeholder-gray-500"
                  />
                </div>
              )

              return (
                <div
                  key={card.id}
                  className="rounded-xl p-4 space-y-3 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-gray-500">Layout:</label>
                    <select
                      value={layout}
                      onChange={e => handleLayoutChangeForCard(card.id, e.target.value as CardLayoutPosition)}
                      className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-xs focus:border-white/20 focus:outline-none"
                    >
                      {LAYOUT_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {layout === 'top' && (
                    <>
                      {renderImageSlot(card, 'w-full h-24 block')}
                      {textBlock}
                    </>
                  )}
                  {layout === 'bottom' && (
                    <>
                      {textBlock}
                      {renderImageSlot(card, 'w-full h-24 block')}
                    </>
                  )}
                  {layout === 'left' && (
                    <div className="flex gap-4">
                      {renderImageSlot(card, 'w-24 min-h-[80px] flex-shrink-0')}
                      <div className="flex-1 min-w-0">{textBlock}</div>
                    </div>
                  )}
                  {layout === 'right' && (
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">{textBlock}</div>
                      {renderImageSlot(card, 'w-24 min-h-[80px] flex-shrink-0')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {saveStatus !== 'idle' && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            saveStatus === 'error'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : saveStatus === 'done'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
          }`}>
            {isSaving && <span className="inline-block w-3 h-3 rounded-full bg-current animate-pulse mr-2 align-middle" />}
            {saveMessage}
          </div>
        )}

        {!embedded && (cardsDirty || layoutsDirty) && !loadingCards && (
          <button
            onClick={handleSaveCards}
            disabled={isSaving}
            className="mt-3 w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#6366F1', color: '#fff' }}
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      {/* Hidden media file input (shared across all cards) */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaChange}
        className="hidden"
      />
    </div>
  )
}
