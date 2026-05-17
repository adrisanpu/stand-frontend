import { useEffect, useMemo, useState } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'

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

export default function ImpostorGameConfig({ gameId, settings, onChange }: GameConfigProps) {
  const s = (settings || {}) as ImpostorSettings
  const [maxPlayers, setMaxPlayers] = useState<number>(s.maxPlayers ?? 8)
  const [wordsText, setWordsText] = useState<string>((s.words && s.words.length ? s.words : DEFAULT_WORDS).join('\n'))
  const [status, setStatus] = useState<string>('')
  const normalizedWords = useMemo(
    () =>
      wordsText
        .split('\n')
        .map((w) => w.trim())
        .filter(Boolean),
    [wordsText],
  )

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const max = data.settings?.impostor?.maxPlayers ?? data.game?.maxPlayers
        const words = data.settings?.impostor?.words
        if (typeof max === 'number') setMaxPlayers(Math.max(3, Math.min(25, Math.floor(max))))
        if (words?.length) setWordsText(words.join('\n'))
      } catch {
        // keep local defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const save = async () => {
    const payload: ImpostorSettings = {
      maxPlayers: Math.max(3, Math.min(25, Math.floor(maxPlayers))),
      words: normalizedWords.length ? normalizedWords : DEFAULT_WORDS,
    }
    onChange(payload)
    if (!gameId) {
      setStatus('Configuración guardada.')
      return
    }
    setStatus('Guardando...')
    try {
      await api.put('/v1/game', { gameId, settings: { impostor: payload } })
      setStatus('Configuración guardada correctamente.')
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'No se pudo guardar la configuración.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="impostor-max-players" className="block text-sm text-gray-300 mb-2">
          Jugadores máximos (3-25)
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

      <div>
        <label htmlFor="impostor-words" className="block text-sm text-gray-300 mb-2">
          Palabras (una por línea)
        </label>
        <textarea
          id="impostor-words"
          rows={10}
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          className="w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 p-3 outline-none focus:border-white/20"
        />
      </div>

      {status && <p className="text-sm text-gray-300">{status}</p>}
      <button
        type="button"
        onClick={save}
        className="w-full p-3 rounded-xl bg-[rgba(124,58,237,0.25)] border border-[rgba(124,58,237,0.45)] hover:bg-[rgba(124,58,237,0.35)] transition-colors font-medium"
      >
        Guardar configuración
      </button>
    </div>
  )
}
