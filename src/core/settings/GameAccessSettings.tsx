import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/api'
import type { ParticipantFieldsConfig } from '../../api/publicApi'
import { resolveParticipantFields } from '../lib/participantFields'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { resolveGameAccess, type GameAccess } from './gameAccess'

export type GameAccessLoadStatus = 'loading' | 'ready' | 'error'

export type GameAccessDraft = {
  access: GameAccess | null
  status: GameAccessLoadStatus
  loadError: string
  setAccess: (access: GameAccess) => void
  reload: () => void
  participantFields: ReturnType<typeof resolveParticipantFields>
  setParticipantFields: (fields: ReturnType<typeof resolveParticipantFields>) => void
  /** Validates and persists the current draft. Rejects with an Error on failure. */
  persist: (includeParticipantFields?: boolean) => Promise<GameAccess>
}

type Translator = ReturnType<typeof useOperatorLanguage>['t']

export function translateGameAccessMessage(message: string, t: Translator): string {
  const translations: Record<string, string> = {
    'No se pudo cargar el acceso del juego.': t('No se pudo cargar el acceso del juego.', 'Could not load game access.'),
    'El modo y acceso aún no se han cargado.': t('El modo y acceso aún no se han cargado.', 'Game mode and access have not loaded yet.'),
    'No se pudo guardar el acceso del juego.': t('No se pudo guardar el acceso del juego.', 'Could not save game access.'),
    'Canal de acceso no válido.': t('Canal de acceso no válido.', 'Invalid access channel.'),
    'Modo de juego no válido.': t('Modo de juego no válido.', 'Invalid game mode.'),
    'Esta combinación de modo y acceso no está disponible para el juego.': t('Esta combinación de modo y acceso no está disponible para el juego.', 'This game mode and access combination is not available for this game.'),
  }
  if (message.startsWith('Juego no compatible: ')) {
    return `${t('Juego no compatible:', 'Unsupported game:')} ${message.slice('Juego no compatible: '.length)}`
  }
  return Object.prototype.hasOwnProperty.call(translations, message) ? translations[message] : message
}

/** Loads the saved playMode/joinChannel and keeps an unsaved draft. Nothing is persisted until `persist`. */
export function useGameAccessDraft(gameId: string, gameType: string, onLoaded?: (access: GameAccess) => void): GameAccessDraft {
  const [access, setAccess] = useState<GameAccess | null>(null)
  const [status, setStatus] = useState<GameAccessLoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [participantFields, setParticipantFields] = useState(resolveParticipantFields)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setAccess(null)
    setLoadError('')
    void api.get<{ ok: boolean; game?: { playMode?: string; joinChannel?: string; participantFields?: ParticipantFieldsConfig } }>(
      `/v1/game?gameId=${encodeURIComponent(gameId)}`,
    ).then((data) => {
      if (cancelled) return
      if (!data.ok || !data.game) throw new Error('No se pudo cargar el acceso del juego.')
      const loaded = resolveGameAccess(gameType, data.game)
      setAccess(loaded)
      setParticipantFields(resolveParticipantFields(data.game.participantFields))
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

  const persist = async (includeParticipantFields = false) => {
    if (!access) {
      throw new Error(loadError || 'El modo y acceso aún no se han cargado.')
    }
    const valid = resolveGameAccess(gameType, access)
    const result = await api.put<{ ok?: boolean }>('/v1/game', {
      gameId, ...valid,
      ...(includeParticipantFields ? { participantFields } : {}),
    })
    if (result?.ok === false) throw new Error('No se pudo guardar el acceso del juego.')
    return valid
  }

  return { access, status, loadError, setAccess, reload, persist, participantFields, setParticipantFields }
}

type FieldsProps = {
  gameType: string
  access: GameAccess | null
  disabled?: boolean
  onChange: (access: GameAccess) => void
}

export function GameAccessFields({ gameType, access, disabled = false, onChange }: FieldsProps) {
  const { t } = useOperatorLanguage()
  void onChange
  const supported = Boolean(gameType && access)
  return (
    <div className="grid grid-cols-2 gap-3">
      <fieldset disabled className="min-w-0">
        <legend className="text-sm font-medium mb-2">{t('Modo de juego', 'Game mode')}</legend>
        <p className={`min-w-0 rounded-xl px-2 py-3 text-center text-sm border ${supported ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10'} ${disabled ? 'opacity-50' : ''}`}>
          {t('∞ móviles', '∞ mobile devices')}
        </p>
      </fieldset>
      <fieldset disabled className="min-w-0">
        <legend className="text-sm font-medium mb-2">{t('Acceso del participante', 'Participant access')}</legend>
        <p className={`min-w-0 rounded-xl px-2 py-3 text-center text-sm border ${supported ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10'} ${disabled ? 'opacity-50' : ''}`}>
          Web
        </p>
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
  const { t } = useOperatorLanguage()
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
      {draft.status === 'loading' && <p role="status">{t('Cargando acceso...', 'Loading access...')}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{translateGameAccessMessage(error, t)}</p>}
      {draft.status === 'error' ? (
        <button type="button" onClick={draft.reload}>{t('Reintentar carga', 'Retry loading')}</button>
      ) : (
        <button type="button" disabled={!draft.access || saveStatus === 'saving'} onClick={() => void save()}
          className="w-full rounded-xl p-3 bg-primary/20 border border-primary/30 disabled:opacity-50">
          {saveStatus === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar modo y acceso', 'Save mode and access')}
        </button>
      )}
      {saveStatus === 'saved' && <p role="status">{t('Modo y acceso guardados.', 'Game mode and access saved.')}</p>}
    </div>
  )
}
