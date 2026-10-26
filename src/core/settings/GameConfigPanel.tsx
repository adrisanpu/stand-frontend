import { useCallback, useRef, useState } from 'react'
import type { GameConfigSaveRegistration, GameDefinition } from '../types'
import { getRedeemUrl, getWebPlayUrl } from '../lib/joinUrl'
import QRCode from '../widgets/QRCode'
import { GameAccessFields, translateGameAccessMessage, useGameAccessDraft } from './GameAccessSettings'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess, type GameAccess } from './gameAccess'
import { saveErrorMessage } from './gameConfigSave'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import KivlySettings, { KivlyRewardSettings, useKivlyDraft, useKivlyRewardDraft } from './KivlySettings'

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
 * Shared "Configurar juego" body: fixed mobile/Web access, optional game-specific config and one
 * footer button that persists everything together.
 */
export default function GameConfigPanel({ gameId, gameDefinition, settings, onSettingsChange, onSaved, onSavingChange }: Props) {
  const { t } = useOperatorLanguage()
  const accessDraft = useGameAccessDraft(gameId, gameDefinition.id)
  const isStack = gameDefinition.id.toUpperCase() === 'STACK'
  const kivly = useKivlyDraft(gameId, isStack)
  const hasKivlyReward = isStack && kivly.settings?.enabled === true
  const kivlyReward = useKivlyRewardDraft(gameId, hasKivlyReward)
  const participantFields = accessDraft.participantFields
  const GameConfigComponent = gameDefinition.GameConfigComponent
  const rulesSaveRef = useRef<GameConfigSaveRegistration | null>(null)
  const savingRef = useRef(false)
  const pendingPatchRef = useRef<Record<string, unknown>>({})
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const saving = saveState.status === 'saving'
  const supportsMobile = GAME_ACCESS_CAPABILITIES[gameDefinition.id.toUpperCase()]?.playModes.includes('mobile')
  const redeemUrl = getRedeemUrl(gameId)
  const playUrl = getWebPlayUrl(gameId)

  const translateSaveError = (message: string): string => {
    const exact: Record<string, string> = {
      'El modo y acceso aún se están cargando.': t('El modo y acceso aún se están cargando.', 'Game mode and access are still loading.'),
      'Modo y acceso no válidos.': t('Modo y acceso no válidos.', 'Invalid game mode and access.'),
      'La configuración del juego aún no está lista. Inténtalo de nuevo.': t('La configuración del juego aún no está lista. Inténtalo de nuevo.', 'Game settings are not ready yet. Please try again.'),
      'error desconocido.': t('error desconocido.', 'unknown error.'),
      'No se pudo guardar la configuración del juego.': t('No se pudo guardar la configuración del juego.', 'Could not save game settings.'),
      'No se pudo guardar.': t('No se pudo guardar.', 'Could not save.'),
    }
    if (Object.prototype.hasOwnProperty.call(exact, message)) return exact[message]
    const prefixes: Array<[string, string]> = [
      ['No se puede guardar: ', `${t('No se puede guardar:', 'Cannot save:')} `],
      ['No se pudo guardar el modo y acceso: ', `${t('No se pudo guardar el modo y acceso:', 'Could not save game mode and access:')} `],
      ['El modo y acceso se guardaron, pero la configuración del juego no: ', `${t('El modo y acceso se guardaron, pero la configuración del juego no:', 'Game mode and access were saved, but game settings were not:')} `],
    ]
    for (const [spanish, translated] of prefixes) {
      if (message.startsWith(spanish)) {
        const rest = message.slice(spanish.length)
        return translated + translateGameAccessMessage(rest, t)
      }
    }
    return translateGameAccessMessage(message, t)
  }

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
        access = await accessDraft.persist(supportsMobile)
        accessSaved = true
      } catch (cause) {
        throw new Error(`No se pudo guardar el modo y acceso: ${saveErrorMessage(cause, 'error desconocido.')}`)
      }
      await kivlyReward.persist()
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
    const patch: GameConfigSavedPatch = {
      ...pendingPatchRef.current, ...access,
      ...(supportsMobile ? { participantFields } : {}),
    }
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
          {accessDraft.status === 'loading' && <p role="status">{t('Cargando acceso...', 'Loading access...')}</p>}
          {accessDraft.status === 'error' && (
            <>
              <p role="alert" className="text-sm text-red-300">{translateGameAccessMessage(accessDraft.loadError, t)}</p>
              <button type="button" onClick={accessDraft.reload} className="text-sm underline">{t('Reintentar carga', 'Retry loading')}</button>
            </>
          )}
          {gameId && supportsMobile && (
            <section aria-label={t('Enlaces del evento', 'Event links')} className="grid grid-cols-3 items-start gap-3 border-t border-white/10 pt-3 text-xs">
              <div className="min-w-0 space-y-2 text-center">
                <QRCode data={playUrl} size={80} margin={4} alt={t('QR participante', 'Participant QR code')} className="!bg-white !p-1" />
                <a href={playUrl} target="_blank" rel="noopener noreferrer" className="block text-primary underline underline-offset-4">
                  {t('Participante', 'Participant')}
                </a>
              </div>
              <div className="min-w-0 space-y-2 text-center">
                <QRCode data={redeemUrl} size={80} margin={4} alt={t('QR validador de premios', 'Prize validator QR code')} className="!bg-white !p-1" />
                <a href={redeemUrl} target="_blank" rel="noopener noreferrer" className="block text-primary underline underline-offset-4">
                  {t('Validador de premios', 'Prize validator')}
                </a>
              </div>
              <fieldset disabled={accessDraft.status !== 'ready'} className="min-w-0 space-y-2">
                <legend className="mb-2 font-medium">{t('Datos del participante', 'Participant information')}</legend>
                <p>{t('Nombre completo y email obligatorios', 'Full name and email required')}</p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={participantFields.phone.enabled}
                    onChange={(event) => accessDraft.setParticipantFields({
                      ...participantFields, phone: { required: false, enabled: event.target.checked },
                    })} />
                  {t('Mostrar teléfono (opcional)', 'Show phone (optional)')}
                </label>
              </fieldset>
            </section>
          )}
        </fieldset>
        {isStack && <KivlySettings key={gameId} draft={kivly} />}
        {hasKivlyReward && <fieldset disabled={saving}><KivlyRewardSettings draft={kivlyReward} /></fieldset>}
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
          <p role="alert" className="text-sm text-red-300">{translateSaveError(saveState.message)}</p>
        )}
        {saving && <p role="status" className="text-sm text-textSub">{t('Guardando cambios...', 'Saving changes...')}</p>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || accessDraft.status !== 'ready'
            || (hasKivlyReward && kivlyReward.status !== 'ready')}
          className="w-full rounded-xl p-3 font-medium bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('Guardando...', 'Saving...') : t(GAME_CONFIG_SAVE_LABEL, 'Save and apply changes')}
        </button>
      </div>
    </>
  )
}
