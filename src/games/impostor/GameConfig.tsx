import { useEffect, useMemo, useState } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import SaveButton from '../../core/ui/SaveButton'
import { localizeOperatorMessage } from '../operatorText'
import { useMechanicsDraft } from '../useMechanicsDraft'

type ImpostorSettings = {
  maxPlayers?: number
  words?: string[]
}

type GameDataResponse = {
  ok: boolean
  game?: { maxPlayers?: number }
  settings?: { impostor?: ImpostorSettings }
}

const DEFAULT_WORDS = ['playa', 'montana', 'pizza', 'cine', 'futbol', 'musica']

export default function ImpostorGameConfig({ gameId, settings, settingsLoaded, onChange, onDraftChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const s = (settings || {}) as ImpostorSettings
  const [maxPlayers, setMaxPlayers] = useState<number>(s.maxPlayers ?? 8)
  const [wordsText, setWordsText] = useState<string>((s.words ?? DEFAULT_WORDS).join('\n'))
  const [status, setStatus] = useState<string>('')
  const [loaded, setLoaded] = useState(settingsLoaded || !gameId)
  const normalizedWords = useMemo(
    () =>
      wordsText
        .split('\n')
        .map((w) => w.trim())
        .filter(Boolean),
    [wordsText],
  )
  useMechanicsDraft(loaded ? { maxPlayers, words: normalizedWords } : null, onDraftChange)

  useEffect(() => {
    if (!gameId || settingsLoaded) return
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled) return
        if (!data.ok) throw new Error('No se pudo cargar la configuración.')
        const max = data.settings?.impostor?.maxPlayers ?? data.game?.maxPlayers
        const words = data.settings?.impostor?.words
        if (typeof max === 'number') setMaxPlayers(max)
        if (words) setWordsText(words.join('\n'))
        setLoaded(true)
      } catch (cause) {
        if (!cancelled) setStatus(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, settingsLoaded])

  const validate = () => !loaded ? t('La configuración no está disponible.', 'Settings are unavailable.') : null

  const persist = async () => {
    const invalid = validate()
    if (invalid) throw new Error(invalid)
    const payload: ImpostorSettings = {
      maxPlayers: Math.max(3, Math.min(25, Math.floor(maxPlayers))),
      words: normalizedWords.length ? normalizedWords : DEFAULT_WORDS,
    }
    if (gameId) await api.put('/v1/game', { gameId, settings: { impostor: payload } })
    onChange(payload)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const save = async () => {
    if (gameId) setStatus(t('Guardando...', 'Saving...'))
    try {
      await persist()
      setStatus(gameId ? t('Configuración guardada correctamente.', 'Configuration saved successfully.') : t('Configuración guardada.', 'Configuration saved.'))
    } catch (e: unknown) {
      setStatus(saveErrorMessage(e, t('No se pudo guardar la configuración.', 'Could not save the configuration.')))
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor="impostor-max-players" className="block text-sm text-gray-300 mb-2">
            {t('Jugadores máximos (3-25)', 'Maximum players (3-25)')}
          </label>
          <input
            id="impostor-max-players"
            type="number"
            min={3}
            max={25}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 outline-none focus:border-white/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="impostor-words" className="block text-sm text-gray-300 mb-2">
          {t('Palabras (una por línea)', 'Words (one per line)')}
        </label>
        <textarea
          id="impostor-words"
          rows={10}
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          className="w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 p-3 outline-none focus:border-white/20"
        />
      </div>

      {status && <p className="text-sm text-gray-300">{localizeOperatorMessage(status, t)}</p>}
      {!embedded && (
        <SaveButton
          type="button"
          onClick={save}
          className="w-full"
        >
          {t('Guardar configuración', 'Save configuration')}
        </SaveButton>
      )}
    </div>
  )
}
