import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/api'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess, type GameAccess } from './gameAccess'

export type GameAccessLoadStatus = 'loading' | 'ready' | 'error'

export type GameAccessDraft = {
  access: GameAccess | null
  status: GameAccessLoadStatus
  loadError: string
  setAccess: (access: GameAccess) => void
  reload: () => void
  /** Validates and persists the current draft. Rejects with an Error on failure. */
  persist: () => Promise<GameAccess>
}

/** Loads the saved playMode/joinChannel and keeps an unsaved draft. Nothing is persisted until `persist`. */
export function useGameAccessDraft(gameId: string, gameType: string, onLoaded?: (access: GameAccess) => void): GameAccessDraft {
  const [access, setAccess] = useState<GameAccess | null>(null)
  const [status, setStatus] = useState<GameAccessLoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setAccess(null)
    setLoadError('')
    void api.get<{ ok: boolean; game?: { playMode?: string; joinChannel?: string } }>(
      `/v1/game?gameId=${encodeURIComponent(gameId)}`,
    ).then((data) => {
      if (cancelled) return
      if (!data.ok || !data.game) throw new Error('No se pudo cargar el acceso del juego.')
      const loaded = resolveGameAccess(gameType, data.game)
      setAccess(loaded)
      onLoaded?.(loaded)
      setStatus('ready')
    }).catch((cause: unknown) => {
      if (cancelled) return
      setStatus('error')
      setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar el acceso del juego.')
    })
    return () => { cancelled = true }
  }, [gameId, gameType, loadVersion, onLoaded])

  const reload = useCallback(() => setLoadVersion((v) => v + 1), [])

  const persist = async () => {
    if (!access) {
      throw new Error(loadError || 'El modo y acceso aún no se han cargado.')
    }
    const valid = resolveGameAccess(gameType, access)
    const result = await api.put<{ ok?: boolean }>('/v1/game', { gameId, ...valid })
    if (result?.ok === false) throw new Error('No se pudo guardar el acceso del juego.')
    return valid
  }

  return { access, status, loadError, setAccess, reload, persist }
}

type FieldsProps = {
  gameType: string
  access: GameAccess | null
  disabled?: boolean
  onChange: (access: GameAccess) => void
}

export function GameAccessFields({ gameType, access, disabled = false, onChange }: FieldsProps) {
  const capabilities = GAME_ACCESS_CAPABILITIES[gameType.toUpperCase()]
  return (
    <div className="grid grid-cols-2 gap-3">
      <fieldset disabled={!access || disabled} className="min-w-0">
        <legend className="text-sm font-medium mb-2">Modo de juego</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['master', 'mobile'] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={access?.playMode === mode}
              disabled={!capabilities?.playModes.includes(mode)}
              onClick={() => { if (access) onChange({ ...access, playMode: mode }) }}
              className={`min-w-0 rounded-xl px-2 py-3 text-sm border disabled:opacity-40 disabled:cursor-not-allowed ${access?.playMode === mode ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10'}`}>
              {mode === 'master' ? '1 pantalla' : '∞ móviles'}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={!access || disabled} className="min-w-0">
        <legend className="text-sm font-medium mb-2">Acceso del participante</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['instagram', 'web'] as const).map((channel) => (
            <button key={channel} type="button" aria-pressed={access?.joinChannel === channel}
              disabled={!capabilities?.joinChannels.includes(channel)}
              onClick={() => { if (access) onChange({ ...access, joinChannel: channel }) }}
              className={`min-w-0 rounded-xl px-2 py-3 text-sm border disabled:opacity-40 disabled:cursor-not-allowed ${access?.joinChannel === channel ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10'}`}>
              {channel === 'instagram' ? 'Instagram' : 'Web'}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

type Props = {
  gameId: string
  gameType: string
  onLoaded: (access: GameAccess) => void
  onSaved: (access: GameAccess) => void
}

/** Standalone access editor with its own save button (the shared config modal uses the footer instead). */
export default function GameAccessSettings({ gameId, gameType, onLoaded, onSaved }: Props) {
  const draft = useGameAccessDraft(gameId, gameType, onLoaded)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')

  const save = async () => {
    if (!draft.access) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      const valid = await draft.persist()
      onSaved(valid)
      setSaveStatus('saved')
    } catch (cause) {
      setSaveStatus('idle')
      setSaveError(cause instanceof Error ? cause.message : 'No se pudo guardar el acceso del juego.')
    }
  }

  const error = draft.loadError || saveError

  return (
    <div className="space-y-4 border-b border-white/10 pb-6 mb-6">
      <GameAccessFields gameType={gameType} access={draft.access} disabled={saveStatus === 'saving'}
        onChange={(next) => { draft.setAccess(next); setSaveStatus('idle') }} />
      {draft.status === 'loading' && <p role="status">Cargando acceso...</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {draft.status === 'error' ? (
        <button type="button" onClick={draft.reload}>Reintentar carga</button>
      ) : (
        <button type="button" disabled={!draft.access || saveStatus === 'saving'} onClick={() => void save()}
          className="w-full rounded-xl p-3 bg-primary/20 border border-primary/30 disabled:opacity-50">
          {saveStatus === 'saving' ? 'Guardando...' : 'Guardar modo y acceso'}
        </button>
      )}
      {saveStatus === 'saved' && <p role="status">Modo y acceso guardados.</p>}
    </div>
  )
}
