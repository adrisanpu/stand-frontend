import { useCallback, useEffect, useState } from 'react'
import { kivlyApi, type KivlyAccountConnection, type KivlyClubSettings } from '../../api/kivlyApi'
import { hasDemoKivlyLinks } from './KivlySettings'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'

type Props = {
  onBack: () => void
  onClose: () => void
}

function defaultClub(connection: KivlyAccountConnection): KivlyClubSettings {
  const saved = connection.clubSettings
  const demo = saved && hasDemoKivlyLinks({ ...saved, enabled: false })
  return {
    clubName: (!demo && saved?.clubName) || connection.locations[0]?.name || '',
    privacyUrl: (!demo && saved?.privacyUrl) || new URL(PRIVACY_POLICY_URL, window.location.origin).href,
    termsUrl: (!demo && saved?.termsUrl) || new URL('/pages/legal.html', window.location.origin).href,
  }
}

function connectionError(cause: unknown, t: (spanish: string, english?: string) => string) {
  const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined
  if (status === 404) {
    return t(
      'La ruta de Kivly no está disponible en el backend. Despliega la versión del backend que incluye /v1/kivly.',
      'The Kivly endpoint is not available on the backend. Deploy the backend version that includes /v1/kivly.',
    )
  }
  if (status === 401 || status === 403) {
    return t('Tu sesión no está autorizada. Vuelve a iniciar sesión e inténtalo de nuevo.', 'Your session is not authorized. Sign in again and retry.')
  }
  return t('No se pudo comprobar la conexión con Kivly. Comprueba la conexión y vuelve a intentarlo.', 'Could not check the Kivly connection. Check your connection and try again.')
}

export default function IntegrationsSettings({ onBack, onClose }: Props) {
  const { t } = useOperatorLanguage()
  const [connection, setConnection] = useState<KivlyAccountConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [credentialFormOpen, setCredentialFormOpen] = useState(false)
  const [editingCredentials, setEditingCredentials] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [club, setClub] = useState<KivlyClubSettings | null>(null)

  const refresh = useCallback(async (): Promise<KivlyAccountConnection | null> => {
    setLoading(true)
    try {
      const current = await kivlyApi.getAccountConnection()
      setConnection(current)
      setClub((previous) => previous ?? defaultClub(current))
      setError('')
      return current
    } catch (cause) {
      setError(connectionError(cause, t))
      return null
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void refresh() }, [refresh])

  const updateConnection = async (disconnect = false) => {
    if (busy || (!disconnect && (!clientId.trim() || !clientSecret.trim()))) {
      if (!disconnect) setError(t('Introduce client_id y client_secret.', 'Enter client_id and client_secret.'))
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    setClientId('')
    setClientSecret('')
    try {
      const cleanupWarning = disconnect
        ? await kivlyApi.disconnectAccount()
        : await kivlyApi.connectAccount(clientId.trim(), clientSecret)
      const current = await refresh()
      if (current?.connected === !disconnect) {
        setClub(defaultClub(current))
        setCredentialFormOpen(false)
        setEditingCredentials(false)
        setConfirmDisconnect(false)
        setMessage(t('Conexión actualizada.', 'Connection updated.')
          + (cleanupWarning ? ` ${t('La limpieza de la credencial anterior requiere soporte.', 'Cleanup of the previous credential requires support.')}` : ''))
      } else if (current) {
        setError(t('El estado de conexión no coincide con el cambio solicitado. Compruébalo antes de reintentar.', 'Connection state does not match the requested change. Check it before retrying.'))
      }
    } catch {
      setError(t('No se pudo actualizar la conexión con Kivly.', 'Could not update the Kivly connection.'))
    } finally {
      setBusy(false)
    }
  }

  const saveClub = async () => {
    if (!club || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await kivlyApi.saveClubSettings(club)
      setMessage(t('Club guardado para tus juegos.', 'Club saved for your games.'))
    } catch {
      setError(t('No se pudo guardar el club. Inténtalo de nuevo.', 'Could not save the club. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm'
  const buttonClass = 'rounded-lg border border-primary/30 bg-primary/20 px-3 py-1.5 text-sm hover:bg-primary/30 disabled:opacity-50'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="integrations-title" className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-md p-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-white/10" aria-label={t('Volver', 'Back')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 id="integrations-title" className="text-xl font-semibold">{t('Integraciones', 'Integrations')}</h2>
          <button type="button" onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-white/10" aria-label={t('Cerrar configuración', 'Close settings')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto">
          <section aria-label="Kivly" className="space-y-2">
            <img src="/images/kivly-logo.svg" alt="Kivly" className="h-7 w-auto" />
            <p className="text-xs text-textSub">
              {t('Una conexión y un club para tus juegos. Claves guardadas solo en el servidor.', 'One connection and club for your games. Credentials stored only on the server.')}
            </p>
            {loading ? <p role="status">{t('Comprobando conexión...', 'Checking connection...')}</p> : connection ? (
              <>
                <p role="status" className="text-sm">
                  {connection.connected ? t('Conectado', 'Connected') : t('Desconectado', 'Not connected')}
                </p>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm">
                  <span>{t('Activar integración Kivly', 'Enable Kivly integration')}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={t('Activar integración Kivly', 'Enable Kivly integration')}
                    checked={connection.connected || credentialFormOpen}
                    disabled={busy}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setCredentialFormOpen(true)
                        setConfirmDisconnect(false)
                      } else if (connection.connected) {
                        setConfirmDisconnect(true)
                      } else {
                        setCredentialFormOpen(false)
                        setClientId('')
                        setClientSecret('')
                      }
                    }}
                  />
                </label>
              </>
            ) : <button type="button" className="text-sm underline" onClick={() => void refresh()}>{t('Reintentar', 'Retry')}</button>}
            {connection && (credentialFormOpen || editingCredentials) && !loading && (
              <fieldset disabled={busy} className="space-y-2">
                <label className="block text-xs">client_id
                  <input className={inputClass} autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} />
                </label>
                <label className="block text-xs">client_secret
                  <input className={inputClass} type="password" autoComplete="new-password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} />
                </label>
                <button type="button" className={buttonClass} onClick={() => void updateConnection()}>
                  {connection?.connected ? t('Actualizar credenciales', 'Update credentials') : t('Conectar Kivly', 'Connect Kivly')}
                </button>
                {connection?.connected && <button type="button" className="ml-3 text-sm underline" onClick={() => {
                  setEditingCredentials(false)
                  setClientId('')
                  setClientSecret('')
                }}>{t('Cancelar', 'Cancel')}</button>}
              </fieldset>
            )}
            {connection?.connected && !editingCredentials && <button type="button" disabled={busy} className="text-sm underline disabled:opacity-50" onClick={() => setEditingCredentials(true)}>{t('Cambiar credenciales', 'Change credentials')}</button>}
            {connection?.connected && !loading && <>
              <p className="text-xs text-textSub">{connection.locations[0]?.name}</p>
              <details className="text-xs">
                <summary className="cursor-pointer">{t('Detalles de conexión', 'Connection details')}</summary>
                <label className="block pt-2">location_id
                  <input className={inputClass} value={connection.locationId ?? ''} readOnly />
                </label>
              </details>
              {club && <details className="rounded-lg border border-white/10 p-2">
                <summary className="cursor-pointer text-sm">{t('Datos del club', 'Club details')}</summary>
                <fieldset disabled={busy} className="space-y-2 pt-2">
                  {(['clubName', 'privacyUrl', 'termsUrl'] as const).map((key) => <label key={key} className="block text-xs">
                    {key === 'clubName' ? t('Nombre del club', 'Club name') : key === 'privacyUrl' ? t('URL de privacidad', 'Privacy URL') : t('URL de condiciones', 'Terms URL')}
                    <input className={inputClass} value={club[key]} maxLength={key === 'clubName' ? 200 : 2048}
                      type={key === 'clubName' ? 'text' : 'url'}
                      onChange={(event) => setClub({ ...club, [key]: event.target.value })} />
                  </label>)}
                  {hasDemoKivlyLinks({ ...club, enabled: false }) && <p className="text-xs text-amber-300">{t('Demo: estos enlaces no permiten altas reales.', 'Demo: these links cannot enable real registrations.')}</p>}
                  <button type="button" className={buttonClass} onClick={() => void saveClub()}>{t('Guardar club', 'Save club')}</button>
                  <p className="text-xs text-textSub">{t('Se aplica automáticamente en todos tus juegos. Los jugadores aceptarán las condiciones actualizadas antes de jugar.', 'Applied automatically across all your games. Players accept updated terms before playing.')}</p>
                </fieldset>
              </details>}
            </>}
            {confirmDisconnect && <div className="space-y-2 text-sm">
              <p>{t('Desconectar afecta a todos tus juegos y no revoca las credenciales en Kivly.', 'Disconnecting affects all your games and does not revoke credentials in Kivly.')}</p>
              <button type="button" disabled={busy} className="text-red-300 underline disabled:opacity-50" onClick={() => void updateConnection(true)}>{t('Confirmar desconexión', 'Confirm disconnection')}</button>
              <button type="button" disabled={busy} className="ml-3 underline disabled:opacity-50" onClick={() => setConfirmDisconnect(false)}>{t('Cancelar', 'Cancel')}</button>
            </div>}
            {busy && <p role="status">{t('Procesando Kivly...', 'Processing Kivly...')}</p>}
            {message && <p role="status" className="text-sm">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
