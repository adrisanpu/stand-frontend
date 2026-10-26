import { useEffect, useRef, useState } from 'react'
import { kivlyApi, type KivlyConnection, type KivlySettings as Settings } from '../../api/kivlyApi'
import { useOperatorLanguage } from '../shell/operatorLanguage'

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
    setStatus('loading')
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

export default function KivlySettings({ draft }: {
  draft: ReturnType<typeof useKivlyDraft>
}) {
  const { t } = useOperatorLanguage()
  const { settings, connection } = draft
  const actionClass = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-50'

  return <section aria-label="Kivly" className="space-y-2 border-b border-white/10 pb-3 mb-3">
    {draft.status === 'loading' && <p role="status">{t('Cargando Kivly...', 'Loading Kivly...')}</p>}
    {draft.status === 'error' && <>
      <p role="alert" className="text-xs text-red-300">{t('No se pudo comprobar Kivly.', 'Could not check Kivly.')}</p>
      <button type="button" className={actionClass} onClick={draft.reload}>{t('Comprobar estado', 'Check status')}</button>
    </>}
    {draft.status === 'ready' && connection?.connected && <div className="flex items-center gap-2 text-xs">
      <img src="/images/kivly-logo.svg" alt="Kivly" className="h-5 w-auto" />
      <span>{t('Conectado', 'Connected')}</span>
      {settings && !settings.enabled && <span className="text-textSub">{t('· Demo, sin altas reales', '· Demo, no real registrations')}</span>}
    </div>}
  </section>
}
