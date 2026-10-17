import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'

interface GameDataResponse {
  ok: boolean
  settings?: { l3tras?: { objectiveWord?: string; validationTimeLimitSeconds?: number } }
}

export type L3trasSettings = {
  objectiveWord: string
  /** Seconds to complete the word after the first successful code validation (default 60). */
  validationTimeLimitSeconds?: number
}

export const DEFAULT_VALIDATION_TIME_LIMIT_SECONDS = 60
export const MIN_VALIDATION_TIME_LIMIT_SECONDS = 15
export const MAX_VALIDATION_TIME_LIMIT_SECONDS = 3600

export function normalizeValidationTimeLimitSeconds(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number.parseInt(raw, 10)
        : Number.NaN
  if (!Number.isFinite(n)) return DEFAULT_VALIDATION_TIME_LIMIT_SECONDS
  return Math.min(
    MAX_VALIDATION_TIME_LIMIT_SECONDS,
    Math.max(MIN_VALIDATION_TIME_LIMIT_SECONDS, Math.floor(n)),
  )
}

const DEFAULT_SETTINGS: L3trasSettings = {
  objectiveWord: 'STAND',
  validationTimeLimitSeconds: DEFAULT_VALIDATION_TIME_LIMIT_SECONDS,
}

export default function L3trasGameConfig({ gameId, settings, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [objectiveWord, setObjectiveWord] = useState<string>(
    (settings as L3trasSettings | null)?.objectiveWord || DEFAULT_SETTINGS.objectiveWord
  )
  const [validationTimeLimitSeconds, setValidationTimeLimitSeconds] = useState<number>(() =>
    normalizeValidationTimeLimitSeconds(
      (settings as L3trasSettings | null)?.validationTimeLimitSeconds,
    ),
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    if (settings) {
      const s = settings as L3trasSettings
      setObjectiveWord((s.objectiveWord || DEFAULT_SETTINGS.objectiveWord).toUpperCase())
      setValidationTimeLimitSeconds(normalizeValidationTimeLimitSeconds(s.validationTimeLimitSeconds))
    }
  }, [settings])

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const backend = data.settings?.l3tras
        if (backend?.objectiveWord) {
          setObjectiveWord(backend.objectiveWord.toUpperCase())
        }
        if (backend?.validationTimeLimitSeconds != null) {
          setValidationTimeLimitSeconds(normalizeValidationTimeLimitSeconds(backend.validationTimeLimitSeconds))
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
  }, [gameId])

  const handleObjectiveWordChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z]/g, '').toUpperCase()
    setObjectiveWord(cleaned)
  }

  const validate = () =>
    !objectiveWord || objectiveWord.length === 0 ? t('La palabra objetivo no puede estar vacía', 'The target word cannot be empty') : null

  const persist = async () => {
    const invalid = validate()
    if (invalid) throw new Error(invalid)
    const newSettings: L3trasSettings = {
      objectiveWord: objectiveWord.toUpperCase(),
      validationTimeLimitSeconds: normalizeValidationTimeLimitSeconds(validationTimeLimitSeconds),
    }
    if (gameId) {
      await api.put('/v1/game', {
        gameId,
        settings: {
          l3tras: {
            objectiveWord: newSettings.objectiveWord,
            validationTimeLimitSeconds: newSettings.validationTimeLimitSeconds,
          },
        },
      })
    }
    onChange(newSettings)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const handleSave = async () => {
    const invalid = validate()
    if (invalid) {
      alert(invalid)
      return
    }
    setSaveStatus('idle')
    setSaveMessage('')

    if (gameId) {
      setSaveStatus('saving')
      setSaveMessage(t('Guardando...', 'Saving...'))
      try {
        await persist()
        setSaveStatus('success')
        setSaveMessage(t('Configuración guardada correctamente.', 'Configuration saved successfully.'))
        setTimeout(() => {
          setSaveStatus('idle')
          setSaveMessage('')
        }, 3000)
      } catch (e: unknown) {
        setSaveStatus('error')
        setSaveMessage(saveErrorMessage(e, t('Error al guardar en el servidor', 'Error saving to the server')))
      }
    } else {
      await persist()
      setSaveStatus('success')
      setSaveMessage(t('Configuración guardada.', 'Configuration saved.'))
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <label htmlFor="l3tras-objective-word" className="block text-sm font-medium text-gray-300">
              {t('Palabra objetivo', 'Target word')}
            </label>
            <span className="group relative inline-flex">
              <button
                type="button"
                aria-label={t('Información sobre palabra objetivo', 'Information about the target word')}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-semibold text-gray-300/90"
              >
                i
              </button>
              <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-64 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/15 bg-[rgba(17,24,39,0.98)] p-2 text-xs text-gray-200 shadow-lg group-hover:block">
                {t('Solo letras A-Z; se guardan en mayúsculas.', 'Letters A-Z only; saved in uppercase.')}
              </span>
            </span>
          </div>
          <input
            id="l3tras-objective-word"
            type="text"
            value={objectiveWord}
            onChange={(e) => handleObjectiveWordChange(e.target.value)}
            placeholder="STAND"
            className="mt-auto w-full min-w-0 h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none uppercase"
          />
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <label htmlFor="l3tras-time-limit" className="block text-sm font-medium text-gray-300">
              {t('Tiempo para completar la palabra (segundos)', 'Time to complete the word (seconds)')}
            </label>
            <span className="group relative inline-flex">
              <button
                type="button"
                aria-label={t('Información sobre tiempo de validación', 'Information about the validation time')}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-semibold text-gray-300/90"
              >
                i
              </button>
              <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-72 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/15 bg-[rgba(17,24,39,0.98)] p-2 text-xs text-gray-200 shadow-lg group-hover:block">
                {t(`Cuenta desde el primer código válido. Por defecto 60 s; entre ${MIN_VALIDATION_TIME_LIMIT_SECONDS} y ${MAX_VALIDATION_TIME_LIMIT_SECONDS} s. Si se agota, el grupo vuelve a empezar.`, `Starts with the first valid code. Default is 60 s; between ${MIN_VALIDATION_TIME_LIMIT_SECONDS} and ${MAX_VALIDATION_TIME_LIMIT_SECONDS} s. If time runs out, the group starts over.`)}
              </span>
            </span>
          </div>
          <input
            id="l3tras-time-limit"
            type="number"
            min={MIN_VALIDATION_TIME_LIMIT_SECONDS}
            max={MAX_VALIDATION_TIME_LIMIT_SECONDS}
            step={1}
            value={validationTimeLimitSeconds}
            onChange={(e) =>
              setValidationTimeLimitSeconds(
                normalizeValidationTimeLimitSeconds(e.target.value === '' ? NaN : Number(e.target.value)),
              )
            }
            className="mt-auto w-full min-w-0 h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      {saveMessage && (
        <p
          className={`text-sm ${saveStatus === 'error' ? 'text-red-400' : saveStatus === 'saving' ? 'text-gray-400' : 'text-[#10B981]'}`}
        >
          {localizeOperatorMessage(saveMessage, t)}
        </p>
      )}

      {!embedded && (
        <button
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
          className="w-full p-3 rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.3)] transition-colors font-medium disabled:opacity-50"
        >
          {t('Guardar configuración', 'Save configuration')}
        </button>
      )}
    </div>
  )
}
