import { useEffect, useRef, useState } from 'react'
import { kivlyApi, type KivlyConnection, type KivlySettings as Settings } from '../../api/kivlyApi'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type GameSettingsPatch = Record<string, any>

export function useKivlyDraft(gameId: string, active: boolean) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [connection, setConnection] = useState<KivlyConnection | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    setSettings(null)
    setConnection(null)
  }, [gameId, active])

  useEffect(() => {
    const current = ++generation.current
    setStatus(active ? 'loading' : 'ready')
    if (active) {
      void kivlyApi.getAccountConnection().then((account) => {
        if (generation.current !== current) return
        const club = {
          enabled: true,
          clubName: account.clubSettings?.clubName ?? '',
          privacyUrl: account.clubSettings?.privacyUrl ?? '',
          termsUrl: account.clubSettings?.termsUrl ?? '',
        }
        setSettings({ ...club, enabled: validKivlySettings(club, account) })
        setConnection(account)
        setStatus('ready')
      }).catch(() => {
        if (generation.current === current) setStatus('error')
      })
    }
    return () => { generation.current += 1 }
  }, [gameId, active, revision])

  return { settings, connection, status,
    reload: () => setRevision((value) => value + 1) }
}

export function hasDemoKivlyLinks(settings: Settings) {
  return [settings.privacyUrl, settings.termsUrl].some((value) => {
    try {
      const host = new URL(value).hostname
      return host === 'example.com' || host.endsWith('.example.com')
    } catch {
      return false
    }
  })
}

export function validKivlySettings(settings: Settings, connection: KivlyConnection | null) {
  if (!settings.enabled) return true
  if (!connection?.connected || !settings.clubName.trim() || hasDemoKivlyLinks(settings)) return false
  return [settings.privacyUrl, settings.termsUrl].every((value) => {
    try {
      const url = new URL(value)
      return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    } catch {
      return false
    }
  })
}

export default function KivlySettings({ draft, onSettingChange, gameSettings }: {
  draft: ReturnType<typeof useKivlyDraft>
  onSettingChange?: (patch: GameSettingsPatch) => void
  gameSettings?: Record<string, any>
}) {
  const { t } = useOperatorLanguage()
  const { connection, settings } = draft
  const actionClass = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-50'
  const currentSettings = (gameSettings?.kivly ?? settings ?? null) as Settings | null
  const [bypassValidation, setBypassValidation] = useState<boolean>(Boolean(currentSettings?.bypassValidation ?? false))

  useEffect(() => {
    setBypassValidation(Boolean(currentSettings?.bypassValidation ?? false))
  }, [currentSettings?.bypassValidation])

  const handleBypassToggle = (value: boolean) => {
    if (!currentSettings) return
    setBypassValidation(value)
    onSettingChange?.({
      kivly: {
        ...currentSettings,
        enabled: currentSettings.enabled ?? true,
        bypassValidation: value,
      },
    })
  }

  return <section aria-label="Kivly" className="space-y-2 border-b border-white/10 pb-3 mb-3">
    {draft.status === 'loading' && <p role="status">{t('Cargando Kivly...', 'Loading Kivly...')}</p>}
    {draft.status === 'error' && <>
      <p role="alert" className="text-xs text-red-300">{t('No se pudo comprobar Kivly.', 'Could not check Kivly.')}</p>
      <button type="button" className={actionClass} onClick={draft.reload}>{t('Comprobar estado', 'Check status')}</button>
    </>}
    {draft.status === 'ready' && connection && <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <img src="/images/kivly-logo.svg" alt="Kivly" className="h-5 w-auto" />
        <span>{connection.connected ? t('Conectado', 'Connected') : t('Desconectado', 'Not connected')}</span>
      </div>
      {connection.connected && currentSettings && onSettingChange && <div className="flex items-center gap-3">
        <span id="kivly-bypass-label" className="text-textSub">
          {t('Validación registros Kivly', 'Kivly registration validation')}
        </span>
        <span className="text-xs text-textSub">OFF</span>
        <button
          type="button"
          role="switch"
          aria-labelledby="kivly-bypass-label"
          aria-checked={bypassValidation}
          onClick={() => handleBypassToggle(!bypassValidation)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${bypassValidation ? 'bg-primary' : 'bg-gray-600'}`}
        >
          <span aria-hidden="true" className={`absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform ${bypassValidation ? 'translate-x-full' : ''}`} />
        </button>
        <span className="text-xs text-textSub">ON</span>
      </div>}
    </div>}
  </section>
}
