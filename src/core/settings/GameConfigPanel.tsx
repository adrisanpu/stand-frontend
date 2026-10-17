import { useCallback, useRef, useState } from 'react'
import type { GameConfigSaveRegistration, GameDefinition } from '../types'
import { getRedeemUrl, getWebPlayUrl } from '../lib/joinUrl'
import QRCode from '../widgets/QRCode'
import { GameAccessFields, useGameAccessDraft } from './GameAccessSettings'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess, type GameAccess } from './gameAccess'
import { saveErrorMessage } from './gameConfigSave'

export type GameConfigSavedPatch = Record<string, unknown> & GameAccess

type Props = {
  gameId: string
  gameDefinition: GameDefinition
  settings: any
  /** Immediate settings updates triggered by explicit non-save actions (e.g. INFOCARDS AI generation). */
  onSettingsChange: (patch: any) => void
  /** Called once after access and game rules were all persisted successfully. */
  onSaved: (patch: GameConfigSavedPatch) => void
  onSavingChange?: (saving: boolean) => void
}

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'error'; message: string }

export const GAME_CONFIG_SAVE_LABEL = 'Guardar y aplicar cambios'

/**
 * Shared "Configurar juego" body: playMode/joinChannel selectors, the optional game-specific
 * config component and a single footer button that persists everything together.
 */
export default function GameConfigPanel({ gameId, gameDefinition, settings, onSettingsChange, onSaved, onSavingChange }: Props) {
  const accessDraft = useGameAccessDraft(gameId, gameDefinition.id)
  const GameConfigComponent = gameDefinition.GameConfigComponent
  const rulesSaveRef = useRef<GameConfigSaveRegistration | null>(null)
  const savingRef = useRef(false)
  const pendingPatchRef = useRef<Record<string, unknown>>({})
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const saving = saveState.status === 'saving'
  const supportsMobile = GAME_ACCESS_CAPABILITIES[gameDefinition.id.toUpperCase()]?.playModes.includes('mobile')
  const redeemUrl = getRedeemUrl(gameId)

  const registerSave = useCallback((registration: GameConfigSaveRegistration | null) => {
    rulesSaveRef.current = registration
  }, [])

  const handleRulesChange = useCallback((patch: any) => {
    if (savingRef.current) {
      // Buffer rule updates produced during the coordinated save; they are applied only if everything succeeds.
      pendingPatchRef.current = { ...pendingPatchRef.current, ...(patch ?? {}) }
      return
    }
    onSettingsChange(patch)
  }, [onSettingsChange])

  const setSaving = (value: boolean) => {
    savingRef.current = value
    onSavingChange?.(value)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    const fail = (message: string) => setSaveState({ status: 'error', message })

    if (accessDraft.status !== 'ready' || !accessDraft.access) {
      fail(accessDraft.loadError
        ? `No se puede guardar: ${accessDraft.loadError}`
        : 'El modo y acceso aún se están cargando.')
      return
    }
    let access: GameAccess
    try {
      access = resolveGameAccess(gameDefinition.id, accessDraft.access)
    } catch (cause) {
      fail(saveErrorMessage(cause, 'Modo y acceso no válidos.'))
      return
    }
    const rules = GameConfigComponent ? rulesSaveRef.current : null
    if (GameConfigComponent && !rules) {
      fail('La configuración del juego aún no está lista. Inténtalo de nuevo.')
      return
    }
    const invalidRules = rules?.validate?.()
    if (invalidRules) {
      fail(invalidRules)
      return
    }

    pendingPatchRef.current = {}
    setSaving(true)
    setSaveState({ status: 'saving' })
    let accessSaved = false
    try {
      try {
        access = await accessDraft.persist()
        accessSaved = true
      } catch (cause) {
        throw new Error(`No se pudo guardar el modo y acceso: ${saveErrorMessage(cause, 'error desconocido.')}`)
      }
      if (rules) {
        try {
          await rules.save()
        } catch (cause) {
          throw new Error(`El modo y acceso se guardaron, pero la configuración del juego no: ${saveErrorMessage(cause, 'error desconocido.')}`)
        }
      }
    } catch (cause) {
      pendingPatchRef.current = {}
      setSaving(false)
      fail(saveErrorMessage(cause, accessSaved ? 'No se pudo guardar la configuración del juego.' : 'No se pudo guardar.'))
      return
    }
    const patch: GameConfigSavedPatch = { ...pendingPatchRef.current, ...access }
    pendingPatchRef.current = {}
    setSaving(false)
    setSaveState({ status: 'idle' })
    onSaved(patch)
  }

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6">
        <fieldset disabled={saving} className="min-w-0 space-y-4 border-b border-white/10 pb-6 mb-6">
          <GameAccessFields
            gameType={gameDefinition.id}
            access={accessDraft.access}
            disabled={saving}
            onChange={(next) => {
              accessDraft.setAccess(next)
              if (saveState.status === 'error') setSaveState({ status: 'idle' })
            }}
          />
          {accessDraft.status === 'loading' && <p role="status">Cargando acceso...</p>}
          {accessDraft.status === 'error' && (
            <>
              <p role="alert" className="text-sm text-red-300">{accessDraft.loadError}</p>
              <button type="button" onClick={accessDraft.reload} className="text-sm underline">Reintentar carga</button>
            </>
          )}
          {gameId && supportsMobile && (
            <section aria-label="Enlaces del evento" className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm">
              <div className="min-w-0 space-y-2">
                <a href={getWebPlayUrl(gameId)} target="_blank" rel="noopener noreferrer" className="block text-primary underline underline-offset-4">
                  Participante (móvil)
                </a>
                <a href={redeemUrl} target="_blank" rel="noopener noreferrer" className="block text-primary underline underline-offset-4">
                  Validador de premios
                </a>
              </div>
              <a href={redeemUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir validador de premios desde el QR" className="shrink-0">
                <QRCode data={redeemUrl} size={80} margin={4} alt="QR validador de premios" className="!bg-white !p-1" />
              </a>
            </section>
          )}
        </fieldset>
        {GameConfigComponent && (
          <fieldset disabled={saving} className="min-w-0">
            <GameConfigComponent
              gameId={gameId}
              gameName={gameDefinition.name}
              settings={settings}
              access={accessDraft.access ?? undefined}
              onChange={handleRulesChange}
              registerSave={registerSave}
            />
          </fieldset>
        )}
      </div>
      <div className="flex-shrink-0 border-t border-white/10 px-6 py-4 space-y-2">
        {saveState.status === 'error' && (
          <p role="alert" className="text-sm text-red-300">{saveState.message}</p>
        )}
        {saving && <p role="status" className="text-sm text-textSub">Guardando cambios...</p>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || accessDraft.status !== 'ready'}
          className="w-full rounded-xl p-3 font-medium bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : GAME_CONFIG_SAVE_LABEL}
        </button>
      </div>
    </>
  )
}
