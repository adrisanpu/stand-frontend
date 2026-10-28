import { useCallback, useEffect, useRef, useState } from 'react'
import { kivlyApi, type KivlyAccountConnection, type KivlyClubSettings } from '../../api/kivlyApi'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'

type Props = { onBack: () => void; onClose: () => void }

function defaultClub(connection: KivlyAccountConnection): KivlyClubSettings {
  return {
    clubName: connection.clubSettings?.clubName || connection.locations[0]?.name || '',
    privacyUrl: connection.clubSettings?.privacyUrl || new URL(PRIVACY_POLICY_URL, window.location.origin).href,
    termsUrl: connection.clubSettings?.termsUrl || new URL('/pages/legal.html', window.location.origin).href,
    ...(connection.clubSettings?.storefrontUrl !== undefined ? { storefrontUrl: connection.clubSettings.storefrontUrl } : {}),
  }
}

function connectionError(cause: unknown, t: (spanish: string, english?: string) => string) {
  const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined
  if (status === 404) return t(
    'La ruta de Kivly no está disponible en el backend. Despliega la versión del backend que incluye /v1/kivly.',
    'The Kivly endpoint is not available on the backend. Deploy the backend version that includes /v1/kivly.',
  )
  if (status === 401 || status === 403) return t(
    'Tu sesión no está autorizada. Vuelve a iniciar sesión e inténtalo de nuevo.',
    'Your session is not authorized. Sign in again and retry.',
  )
  return t('No se pudo comprobar la conexión con Kivly. Vuelve a intentarlo.', 'Could not check the Kivly connection. Try again.')
}

export default function IntegrationsSettings({ onBack, onClose }: Props) {
  const { t } = useOperatorLanguage()
  const text = useRef(t)
  text.current = t
  const [connection, setConnection] = useState<KivlyAccountConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [club, setClub] = useState<KivlyClubSettings | null>(null)
  const generation = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try {
      const next = await kivlyApi.getAccountConnection()
      if (current !== generation.current) return null
      setConnection(next)
      setClub(defaultClub(next))
      setError('')
      return next
    } catch (cause) {
      if (current === generation.current) setError(connectionError(cause, text.current))
      return null
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    return () => { generation.current += 1 }
  }, [refresh])

  const updateConnection = async (disconnect: boolean) => {
    if (busy) return
    if (!disconnect && (!clientId.trim() || !clientSecret.trim())) {
      setError(t('Introduce client_id y client_secret.', 'Enter client_id and client_secret.'))
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    const id = clientId.trim()
    const secret = clientSecret
    setClientId('')
    setClientSecret('')
    try {
      const warning = disconnect ? await kivlyApi.disconnectAccount() : await kivlyApi.connectAccount(id, secret)
      const next = await refresh()
      if (!next) return
      if (next.connected !== !disconnect) {
        setError(t('El estado de conexión no coincide con el cambio solicitado. Compruébalo antes de reintentar.',
          'Connection state does not match the requested change. Check it before retrying.'))
        return
      }
      if (!disconnect) {
        try {
          const defaults = defaultClub(next)
          await kivlyApi.saveClubSettings(defaults)
          setClub(defaults)
        } catch {
          setError(t('Kivly está conectado, pero no se pudo guardar la configuración del club. Pulsa «Guardar web del club» para reintentar.',
            'Kivly is connected, but club settings could not be saved. Press “Save club website” to retry.'))
          return
        }
      }
      setConfirmDisconnect(false)
      setMessage(t('Conexión actualizada.', 'Connection updated.')
        + (warning ? ` ${t('La limpieza de la credencial anterior requiere soporte.', 'Cleanup of the previous credential requires support.')}` : ''))
    } catch {
      setError(t('No se pudo actualizar la conexión con Kivly. Comprueba el estado antes de reintentar.',
        'Could not update the Kivly connection. Check its state before retrying.'))
    } finally { setBusy(false) }
  }

  const saveClub = async () => {
    if (!club || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = { ...club, storefrontUrl: club.storefrontUrl?.trim() ?? '' }
      await kivlyApi.saveClubSettings(saved)
      setClub(saved)
      setMessage(t('Web del club guardada para todos tus STACK.', 'Club website saved for all your STACK games.'))
    } catch {
      setError(t('No se pudo guardar la web del club. Usa el origen HTTPS de tu negocio en kivly.store.',
        'Could not save the club website. Use your business HTTPS origin on kivly.store.'))
    } finally { setBusy(false) }
  }
  const field = 'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm'
  const action = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-50'
  return <div role="dialog" aria-modal="true" aria-labelledby="integrations-title" className="fixed inset-0 z-50 flex items-center justify-center p-6">
    <div className="absolute inset-0 bg-black/70" onClick={() => { if (!busy) onClose() }} aria-hidden="true" />
    <div className="relative card w-full max-w-md p-4 max-h-[90vh] flex flex-col">
      <header className="flex items-center gap-2 mb-3">
        <button type="button" disabled={busy} onClick={onBack} className="p-2 rounded-full hover:bg-white/10" aria-label={t('Volver', 'Back')}>←</button>
        <h2 id="integrations-title" className="text-xl font-semibold">{t('Integraciones', 'Integrations')}</h2>
        <button type="button" disabled={busy} onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-white/10" aria-label={t('Cerrar configuración', 'Close settings')}>×</button>
      </header>
      <div className="overflow-y-auto">
        <details className="rounded-xl border border-white/10" onToggle={(event) => {
          if (!event.currentTarget.open) { setClientId(''); setClientSecret(''); setConfirmDisconnect(false) }
        }}>
          <summary className="cursor-pointer p-3">
            <span className="inline-flex items-center gap-3 align-middle">
              <img src="/images/kivly-logo.svg" alt="Kivly" className="h-6 w-auto" />
              {loading ? <span role="status" className="text-xs">{t('Comprobando...', 'Checking...')}</span>
                : connection && <span role="status" className={`text-xs ${connection.connected ? 'text-green-300' : 'text-textSub'}`}>
                  <span aria-hidden="true">{connection.connected ? '● ' : '○ '}</span>{connection.connected ? t('Conectado', 'Connected') : t('Desconectado', 'Not connected')}
                </span>}
            </span>
          </summary>
          <div className="space-y-3 border-t border-white/10 p-3">
            {!loading && connection && !connection.connected && <form onSubmit={(event) => { event.preventDefault(); void updateConnection(false) }}>
              <fieldset disabled={busy} className="space-y-3">
                <label className="block text-xs">client_id
                  <input className={field} autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} required />
                </label>
                <label className="block text-xs">client_secret
                  <input className={field} type="password" autoComplete="new-password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} required />
                </label>
                <button type="submit" className={action}>{t('Conectar Kivly', 'Connect Kivly')}</button>
              </fieldset>
            </form>}
            {!loading && connection?.connected && <>
              <p className="text-sm font-medium">{connection.locations.find((item) => item.id === connection.locationId)?.name}</p>
              <button type="button" disabled={busy} className="text-sm text-red-300 underline" onClick={() => setConfirmDisconnect(true)}>
                {t('Desconectar', 'Disconnect')}
              </button>
              <a href="https://getkivly.com/auth/login" target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline">
                {t('Acceder a Kivly', 'Open Kivly')}
              </a>
              {club && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void saveClub() }}>
                <label className="block text-xs">{t('Web oficial del club Kivly', 'Official Kivly club website')}
                  <input type="url" disabled={busy} className={field} placeholder="https://tu-negocio.kivly.store"
                    value={club.storefrontUrl ?? ''} onChange={(event) => setClub({ ...club, storefrontUrl: event.target.value })} />
                </label>
                <p className="text-xs text-textSub">{t('Compartida por todos tus STACK. Solo el origen, sin rutas ni identificadores.', 'Shared by all your STACK games. Origin only, without paths or identifiers.')}</p>
                <button type="submit" disabled={busy} className={action}>{t('Guardar web del club', 'Save club website')}</button>
              </form>}
            </>}
            {confirmDisconnect && <div className="space-y-2 text-sm">
              <p>{t('Desconectar afecta a todos tus juegos STACK y no revoca las credenciales en Kivly.', 'Disconnecting affects all your STACK games and does not revoke credentials in Kivly.')}</p>
              <button type="button" disabled={busy} className="text-red-300 underline" onClick={() => void updateConnection(true)}>{t('Confirmar desconexión', 'Confirm disconnection')}</button>
              <button type="button" disabled={busy} className="ml-3 underline" onClick={() => setConfirmDisconnect(false)}>{t('Cancelar', 'Cancel')}</button>
            </div>}
          </div>
        </details>
        {busy && <p role="status" className="mt-2 text-sm">{t('Procesando Kivly...', 'Processing Kivly...')}</p>}
        {message && <p role="status" className="mt-2 text-sm">{message}</p>}
        {error && <div role="alert" className="mt-2 text-sm text-red-300">
          <p>{error}</p>
          <button type="button" disabled={busy} className="underline" onClick={() => void refresh()}>{t('Comprobar conexión', 'Check connection')}</button>
        </div>}
      </div>
    </div>
  </div>
}
