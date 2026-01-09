import { useState } from 'react'
import { api } from '../api/api'

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

export default function Quiz({ onBack, onClose, gameId }: QuizProps) {
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
  const [showImport, setShowImport] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportData, setExportData] = useState<QuizDataResponse | null>(null)
  const [showShareOptions, setShowShareOptions] = useState(false)

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

      await api.post('/quizz', quizData)

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

  const resetQuiz = () => {
    setQuestions([
      {
        id: 'q1',
        text: '',
        options: [{ title: '', payload: '' }]
      }
    ])
    setError(null)
    setSuccess(false)
    setJsonInput('')
    setShowImport(false)
  }

  const importFromJson = () => {
    if (!jsonInput.trim()) {
      setError('Por favor, pega el JSON en el campo de texto')
      return
    }

    try {
      const parsed = JSON.parse(jsonInput.trim())

      // Validate structure
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('El JSON debe contener un array "questions"')
      }

      if (parsed.questions.length === 0) {
        throw new Error('El array "questions" no puede estar vacío')
      }

      if (parsed.questions.length > 5) {
        throw new Error('Máximo 5 preguntas permitidas')
      }

      // Validate and transform questions
      const importedQuestions: Question[] = parsed.questions.map((q: any, index: number) => {
        if (!q.id || !q.text) {
          throw new Error(`La pregunta ${index + 1} debe tener "id" y "text"`)
        }

        if (!q.options || !Array.isArray(q.options)) {
          throw new Error(`La pregunta ${index + 1} debe tener un array "options"`)
        }

        if (q.options.length === 0) {
          throw new Error(`La pregunta ${index + 1} debe tener al menos una opción`)
        }

        if (q.options.length > 3) {
          throw new Error(`La pregunta ${index + 1} no puede tener más de 3 opciones`)
        }

        return {
          id: q.id,
          text: q.text,
          options: q.options.map((opt: any, optIndex: number) => ({
            title: opt.title || '',
            payload: opt.payload || generatePayload(q.id, optIndex)
          }))
        }
      })

      setQuestions(importedQuestions)
      setJsonInput('')
      setShowImport(false)
      setError(null)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('JSON inválido. Por favor, verifica la sintaxis.')
      } else {
        setError(err.message || 'Error al importar el JSON')
      }
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
      const data = await api.get<QuizDataResponse>(`/quizz?gameId=${encodeURIComponent(gameId)}`)
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
          title: `Datos del Quiz - ${exportData.gameId}`,
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
              aria-label="Volver"
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
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-sm">
              ¡Quiz creado exitosamente!
            </div>
          )}

          {/* Import JSON Section */}
          <div className="mb-4">
            {!showImport ? (
              <button
                onClick={() => setShowImport(true)}
                className="w-full p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar desde JSON
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Pegar JSON del quiz
                  </label>
                  <button
                    onClick={() => {
                      setShowImport(false)
                      setJsonInput('')
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Cerrar importación"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Pega aquí el JSON, por ejemplo:&#10;{&#10;  "gameId": "E0001",&#10;  "questions": [...]&#10;}'
                  className="w-full h-32 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm font-mono focus:border-white/20 focus:outline-none resize-none"
                />
                <button
                  onClick={importFromJson}
                  className="w-full mt-3 p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                >
                  Importar y cargar formulario
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
                    Pregunta {questionIndex + 1}
                  </label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => updateQuestionText(questionIndex, e.target.value)}
                    placeholder="Escribe la pregunta aquí..."
                    className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 focus:border-white/20 focus:outline-none"
                  />
                </div>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(questionIndex)}
                    className="ml-3 p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                    aria-label="Eliminar pregunta"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-3">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Opciones de respuesta
                </label>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option.title}
                      onChange={(e) => updateOptionTitle(questionIndex, optionIndex, e.target.value)}
                      placeholder={`Opción ${optionIndex + 1}...`}
                      className="flex-1 h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-gray-200 text-sm focus:border-white/20 focus:outline-none"
                    />
                    {question.options.length > 1 && (
                      <button
                        onClick={() => removeOption(questionIndex, optionIndex)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        aria-label="Eliminar opción"
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
                  + Añadir opción
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
                Añadir pregunta
              </div>
            </button>
          )}
        </div>

        <div className="flex gap-3 flex-shrink-0 mt-4">
          <button
            onClick={resetQuiz}
            className="flex-1 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Reiniciar
          </button>
          <button
            onClick={submitQuiz}
            disabled={isSubmitting}
            className="flex-1 p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Creando quiz...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Crear Quiz
                </>
              )}
            </div>
          </button>
        </div>

        {/* Export Quiz Data Button */}
        <div className="flex-shrink-0 mt-3">
          <button
            onClick={exportQuizData}
            disabled={isExporting || !gameId}
            className="w-full p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2">
              {isExporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Exportando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Exportar Datos del Quiz
                </>
              )}
            </div>
          </button>

          {/* Share Options */}
          {showShareOptions && exportData && (
            <div className="mt-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Opciones de compartir</h3>
                <button
                  onClick={() => {
                    setShowShareOptions(false)
                    setExportData(null)
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Cerrar opciones de compartir"
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
                    Compartir
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
                    Descargar
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

