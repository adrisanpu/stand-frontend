import { useState, useEffect } from 'react'
import { api } from '../../api/api'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type QuizProps = {
  onBack: () => void
  onClose: () => void
  gameId?: string
}

type QuestionOption = {
  title: string
  payload: string
}

type Question = {
  id: string
  text: string
  options: QuestionOption[]
}

type QuizDataResponse = {
  ok: boolean
  gameId: string
  questions: Array<{
    id: string
    text: string
    options: Array<{
      title: string
      payload: string
      answerId: string
    }>
  }>
  players: Array<{
    playerId: number
    instagramPSID: string
    instagramUsername: string
    quizCompleted: boolean
    quizCurrentQuestion: string | null
    quizAnswers: Record<string, string>
  }>
}

function translateQuizMessage(message: string, t: (spanish: string, english?: string) => string): string {
  const knownMessages: Record<string, string> = {
    'Máximo 5 preguntas permitidas': t('Máximo 5 preguntas permitidas', 'A maximum of 5 questions is allowed'),
    'Debe haber al menos una pregunta': t('Debe haber al menos una pregunta', 'There must be at least one question'),
    'Máximo 3 opciones por pregunta': t('Máximo 3 opciones por pregunta', 'A maximum of 3 options is allowed per question'),
    'Debe haber al menos una opción por pregunta': t('Debe haber al menos una opción por pregunta', 'There must be at least one option per question'),
    'No hay gameId disponible': t('No hay gameId disponible', 'No gameId is available'),
    'Error al crear el quiz': t('Error al crear el quiz', 'Error creating the quiz'),
    'Describe el tema del quiz antes de generar.': t('Describe el tema del quiz antes de generar.', 'Describe the quiz topic before generating.'),
    'Generando quiz con IA...': t('Generando quiz con IA...', 'Generating quiz with AI...'),
    'No se generaron preguntas.': t('No se generaron preguntas.', 'No questions were generated.'),
    'Error al generar el quiz.': t('Error al generar el quiz.', 'Error generating the quiz.'),
    'Error al exportar los datos del quiz': t('Error al exportar los datos del quiz', 'Error exporting quiz data'),
    'No se pudo copiar al portapapeles. Por favor, copia manualmente.': t('No se pudo copiar al portapapeles. Por favor, copia manualmente.', 'Could not copy to the clipboard. Please copy it manually.'),
  }
  if (Object.prototype.hasOwnProperty.call(knownMessages, message)) return knownMessages[message]

  let match = message.match(/^La pregunta (\d+) no puede estar vacía$/)
  if (match) return t(`La pregunta ${match[1]} no puede estar vacía`, `Question ${match[1]} cannot be empty`)
  match = message.match(/^La pregunta (\d+) debe tener al menos una opción$/)
  if (match) return t(`La pregunta ${match[1]} debe tener al menos una opción`, `Question ${match[1]} must have at least one option`)
  match = message.match(/^La opción (\d+) de la pregunta (\d+) no puede estar vacía$/)
  if (match) return t(`La opción ${match[1]} de la pregunta ${match[2]} no puede estar vacía`, `Option ${match[1]} in question ${match[2]} cannot be empty`)
  match = message.match(/^Listo\. Se generaron (\d+) preguntas\.$/)
  if (match) return t(`Listo. Se generaron ${match[1]} preguntas.`, `Done. Generated ${match[1]} questions.`)
  return message
}

export default function Quiz({ onBack, onClose, gameId }: QuizProps) {
  const { t } = useOperatorLanguage()
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q1',
      text: '',
      options: [{ title: '', payload: '' }]
    }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateText, setGenerateText] = useState('')
  const [numQuestions, setNumQuestions] = useState(3)
  const [numOptions, setNumOptions] = useState(3)
  const [useEmojis, setUseEmojis] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [generateMessage, setGenerateMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportData, setExportData] = useState<QuizDataResponse | null>(null)
  const [showShareOptions, setShowShareOptions] = useState(false)

  // Load quiz configuration when component mounts or gameId changes
  useEffect(() => {
    const loadQuizConfiguration = async () => {
      if (!gameId) return

      setError(null)

      try {
        const data = await api.get<QuizDataResponse>(`/v1/game/quiz?gameId=${encodeURIComponent(gameId)}`)
        
        // If quiz exists and has questions, load them into the form
        if (data.ok && data.questions && data.questions.length > 0) {
          const loadedQuestions: Question[] = data.questions.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options.map((opt) => ({
              title: opt.title,
              payload: opt.payload
            }))
          }))
          setQuestions(loadedQuestions)
        } else {
          setShowGenerate(true)
        }
      } catch (err: any) {
        // If quiz doesn't exist (404 or similar), that's fine - just start with empty form
        // Only show error for unexpected errors
        if (err.message && !err.message.includes('404') && !err.message.includes('Not found')) {
          console.warn('Error loading quiz configuration:', err.message)
        }
        setShowGenerate(true)
      }
    }

    loadQuizConfiguration()
  }, [gameId])

  const generatePayload = (questionId: string, optionIndex: number): string => {
    if (!gameId) return ''
    const optionSuffix = ['a', 'b', 'c'][optionIndex] || `opt${optionIndex + 1}`
    return `${gameId}_${questionId}_${optionSuffix}`
  }

  const addQuestion = () => {
    if (questions.length >= 5) {
      setError('Máximo 5 preguntas permitidas')
      return
    }
    const newQuestionId = `q${questions.length + 1}`
    setQuestions([
      ...questions,
      {
        id: newQuestionId,
        text: '',
        options: [{ title: '', payload: '' }]
      }
    ])
    setError(null)
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      setError('Debe haber al menos una pregunta')
      return
    }
    const updated = questions.filter((_, i) => i !== index)
    // Renumber question IDs
    const renumbered = updated.map((q, i) => ({
      ...q,
      id: `q${i + 1}`,
      options: q.options.map((opt, optIdx) => ({
        ...opt,
        payload: generatePayload(`q${i + 1}`, optIdx)
      }))
    }))
    setQuestions(renumbered)
    setError(null)
  }

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions]
    updated[index].text = text
    setQuestions(updated)
    setError(null)
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    if (updated[questionIndex].options.length >= 3) {
      setError('Máximo 3 opciones por pregunta')
      return
    }
    const questionId = updated[questionIndex].id
    const optionIndex = updated[questionIndex].options.length
    updated[questionIndex].options.push({
      title: '',
      payload: generatePayload(questionId, optionIndex)
    })
    setQuestions(updated)
    setError(null)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    if (updated[questionIndex].options.length === 1) {
      setError('Debe haber al menos una opción por pregunta')
      return
    }
    updated[questionIndex].options = updated[questionIndex].options.filter((_, i) => i !== optionIndex)
    // Regenerate payloads for remaining options
    updated[questionIndex].options = updated[questionIndex].options.map((opt, i) => ({
      ...opt,
      payload: generatePayload(updated[questionIndex].id, i)
    }))
    setQuestions(updated)
    setError(null)
  }

  const updateOptionTitle = (questionIndex: number, optionIndex: number, title: string) => {
    const updated = [...questions]
    updated[questionIndex].options[optionIndex].title = title
    setQuestions(updated)
    setError(null)
  }

  const validateQuiz = (): boolean => {
    if (!gameId) {
      setError('No hay gameId disponible')
      return false
    }

    if (questions.length === 0) {
      setError('Debe haber al menos una pregunta')
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      if (!question.text.trim()) {
        setError(`La pregunta ${i + 1} no puede estar vacía`)
        return false
      }

      if (question.options.length === 0) {
        setError(`La pregunta ${i + 1} debe tener al menos una opción`)
        return false
      }

      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].title.trim()) {
          setError(`La opción ${j + 1} de la pregunta ${i + 1} no puede estar vacía`)
          return false
        }
      }
    }

    return true
  }

  const submitQuiz = async () => {
    if (!validateQuiz()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Ensure all payloads are generated correctly
      const quizData = {
        gameId,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          options: q.options.map((opt, optIdx) => ({
            title: opt.title.trim(),
            payload: generatePayload(q.id, optIdx)
          }))
        }))
      }

      await api.post('/v1/game/quiz', quizData)

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Error al crear el quiz')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerate = async () => {
    if (!gameId) return
    if (!generateText.trim()) {
      setGenerateStatus('error')
      setGenerateMessage('Describe el tema del quiz antes de generar.')
      return
    }

    setGenerateStatus('loading')
    setGenerateMessage('Generando quiz con IA...')

    try {
      const res = await api.post<{
        ok: boolean
        gameId: string
        questions: Array<{
          id: string
          text: string
          options: Array<{ title: string; payload: string; answerId: string }>
        }>
      }>('/v1/game/quiz/generate', {
        gameId,
        text: generateText.trim(),
        numQuestions,
        numOptions,
        useEmojis,
      })

      if (!res.ok || !res.questions || res.questions.length === 0) {
        throw new Error('No se generaron preguntas.')
      }

      const loaded: Question[] = res.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options.map((opt) => ({ title: opt.title, payload: opt.payload }))
      }))
      setQuestions(loaded)
      setGenerateStatus('done')
      setGenerateMessage(`Listo. Se generaron ${loaded.length} preguntas.`)
      setShowGenerate(false)
    } catch (err: any) {
      setGenerateStatus('error')
      setGenerateMessage(err.message || 'Error al generar el quiz.')
    }
  }

  const exportQuizData = async () => {
    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    setIsExporting(true)
    setError(null)
    setExportData(null)
    setShowShareOptions(false)

    try {
      const data = await api.get<QuizDataResponse>(`/quiz?gameId=${encodeURIComponent(gameId)}`)
      setExportData(data)
      setShowShareOptions(true)
    } catch (err: any) {
      setError(err.message || 'Error al exportar los datos del quiz')
    } finally {
      setIsExporting(false)
    }
  }

  const handleShare = async () => {
    if (!exportData) return

    const jsonString = JSON.stringify(exportData, null, 2)

    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${t('Datos del Quiz', 'Quiz data')} - ${exportData.gameId}`,
          text: jsonString
        })
        return
      } catch (err) {
        // User cancelled or error, fall through to clipboard
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(jsonString)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError('No se pudo copiar al portapapeles. Por favor, copia manualmente.')
    }
  }

  const handleDownload = () => {
    if (!exportData) return

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quiz-data-${exportData.gameId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-2xl max-h-[90vh] p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={t('Volver', 'Go back')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="quiz-title" className="text-xl font-semibold">Quiz</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={t('Cerrar', 'Close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {translateQuizMessage(error, t)}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-sm">
              {t('¡Quiz creado exitosamente!', 'Quiz created successfully!')}
            </div>
          )}

          {/* AI Generation Section */}
          <div className="mb-4">
            <button
              onClick={() => setShowGenerate(v => !v)}
              className="flex items-center justify-between w-full text-left mb-1 p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-expanded={showGenerate}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                {t('IA', 'AI')}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${showGenerate ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showGenerate && (
              <div className="mt-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[100px]">
                    <label className="block text-xs font-medium text-gray-400 mb-1">{t('Nº de preguntas', 'Number of questions')}</label>
                    <select
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                      disabled={generateStatus === 'loading'}
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none disabled:opacity-50"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[100px]">
                    <label className="block text-xs font-medium text-gray-400 mb-1">{t('Nº de respuestas', 'Number of answers')}</label>
                    <select
                      value={numOptions}
                      onChange={(e) => setNumOptions(Number(e.target.value))}
                      disabled={generateStatus === 'loading'}
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none disabled:opacity-50"
                    >
                      {[2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10 items-center pb-0.5">
                    <input
                      type="checkbox"
                      checked={useEmojis}
                      onChange={(e) => setUseEmojis(e.target.checked)}
                      disabled={generateStatus === 'loading'}
                      className="rounded border-white/20 bg-[rgba(255,255,255,0.05)] text-indigo-500 focus:ring-white/20 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-300 whitespace-nowrap">{t('Usar emoticonos', 'Use emojis')}</span>
                  </label>
                </div>

                <textarea
                  value={generateText}
                  onChange={(e) => setGenerateText(e.target.value)}
                  placeholder={t('Describe el tema del quiz...', 'Describe the quiz topic...')}
                  rows={3}
                  disabled={generateStatus === 'loading'}
                  className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none resize-none disabled:opacity-50"
                />

                {generateStatus !== 'idle' && (
                  <div className={`rounded-xl px-3 py-2.5 text-sm ${
                    generateStatus === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : generateStatus === 'done'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                  }`}>
                    {generateStatus === 'loading' && (
                      <span className="inline-block w-3 h-3 rounded-full bg-current animate-pulse mr-2 align-middle" />
                    )}
                    {translateQuizMessage(generateMessage, t)}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generateStatus === 'loading' || !generateText.trim()}
                  className="w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#6366F1', color: '#fff' }}
                >
                  {generateStatus === 'loading' ? t('Generando...', 'Generating...') : t('Generar quiz', 'Generate quiz')}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6 mb-6">
          {questions.map((question, questionIndex) => (
            <div
              key={question.id}
              className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('Pregunta', 'Question')} {questionIndex + 1}
                  </label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => updateQuestionText(questionIndex, e.target.value)}
                    placeholder={t('Escribe la pregunta aquí...', 'Write the question here...')}
                    className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 focus:border-white/20 focus:outline-none"
                  />
                </div>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(questionIndex)}
                    className="ml-3 p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                    aria-label={t('Eliminar pregunta', 'Delete question')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-3">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Opciones de respuesta', 'Answer options')}
                </label>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option.title}
                      onChange={(e) => updateOptionTitle(questionIndex, optionIndex, e.target.value)}
                      placeholder={`${t('Opción', 'Option')} ${optionIndex + 1}...`}
                      className="flex-1 h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none"
                    />
                    {question.options.length > 1 && (
                      <button
                        onClick={() => removeOption(questionIndex, optionIndex)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        aria-label={t('Eliminar opción', 'Delete option')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {question.options.length < 3 && (
                <button
                  onClick={() => addOption(questionIndex)}
                  className="w-full p-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors text-sm text-gray-300"
                >
                  + {t('Añadir opción', 'Add option')}
                </button>
              )}
            </div>
          ))}
          </div>

          {questions.length < 5 && (
            <button
              onClick={addQuestion}
              className="w-full mb-4 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('Añadir pregunta', 'Add question')}
              </div>
            </button>
          )}
        </div>

        <div className="flex gap-3 flex-shrink-0 mt-4 min-w-0">
          <button
            type="button"
            onClick={submitQuiz}
            disabled={isSubmitting}
            className="flex-1 min-w-0 p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="truncate">{t('Creando quiz...', 'Creating quiz...')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="truncate">{t('Crear quiz', 'Create quiz')}</span>
                </>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={exportQuizData}
            disabled={isExporting || !gameId}
            className="flex-1 min-w-0 p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2">
              {isExporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="truncate">{t('Exportando...', 'Exporting...')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="truncate">{t('Exportar', 'Export')}</span>
                </>
              )}
            </div>
          </button>
        </div>

        {showShareOptions && exportData && (
            <div className="flex-shrink-0 mt-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">{t('Opciones de compartir', 'Sharing options')}</h3>
                <button
                  onClick={() => {
                    setShowShareOptions(false)
                    setExportData(null)
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label={t('Cerrar opciones de compartir', 'Close sharing options')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="flex-1 p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {t('Compartir', 'Share')}
                  </div>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 p-2 rounded-lg bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t('Descargar', 'Download')}
                  </div>
                </button>
              </div>
            </div>
        )}
      </div>
    </div>
  )
}
