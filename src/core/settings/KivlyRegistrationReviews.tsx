import { useEffect, useRef, useState } from 'react'
import { kivlyApi, type KivlyRegistrationReview } from '../../api/kivlyApi'
import { useOperatorLanguage } from '../shell/operatorLanguage'

export default function KivlyRegistrationReviews({ gameId }: { gameId: string }) {
  const { t } = useOperatorLanguage()
  const [requests, setRequests] = useState<KivlyRegistrationReview[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const busy = useRef(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])
  const actionClass = 'rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-50'

  const load = async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError('')
    setConfirmId(null)
    const version = generation.current
    try {
      const result = await kivlyApi.listRegistrationReviews(gameId)
      if (version === generation.current) setRequests(result)
    } catch {
      if (version === generation.current) {
        setError(t('No se pudieron cargar las identidades pendientes de Kivly.', 'Could not load pending Kivly identities.'))
      }
    } finally {
      busy.current = false
      if (version === generation.current) setLoading(false)
    }
  }

  const approve = async (requestId: string) => {
    if (busy.current || confirmId !== requestId) return
    busy.current = true
    setBusyId(requestId)
    setError('')
    setSuccess(false)
    const version = generation.current
    try {
      await kivlyApi.approveRegistration(gameId, requestId)
      if (version !== generation.current) return
      setRequests(current => current?.filter(item => item.requestId !== requestId) ?? null)
      setConfirmId(null)
      setSuccess(true)
    } catch {
      if (version === generation.current) {
        setError(t('No se pudo confirmar la vinculación. Actualiza la lista antes de reintentar.', 'Could not confirm the link. Refresh the list before retrying.'))
        setConfirmId(null)
      }
    } finally {
      busy.current = false
      if (version === generation.current) setBusyId(null)
    }
  }

  return <section aria-label={t('Revisión de identidades Kivly', 'Kivly identity review')} className="mt-5 space-y-3 border-t border-white/10 pt-4">
    <h3 className="font-semibold">{t('Identidades Kivly pendientes', 'Pending Kivly identities')}</h3>
    <button type="button" className={actionClass} disabled={loading || busyId !== null} onClick={() => void load()}>
      {loading ? t('Cargando...', 'Loading...') : requests === null
        ? t('Revisar identidades Kivly', 'Review Kivly identities')
        : t('Actualizar identidades', 'Refresh identities')}
    </button>
    {loading && <p role="status">{t('Cargando identidades...', 'Loading identities...')}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {success && <p role="status" className="text-sm">{t('Identidad vinculada. El participante puede reintentar con su mismo código.', 'Identity linked. The participant can retry with the same code.')}</p>}
    {!loading && requests?.length === 0 && <p className="text-sm text-textSub">{t('No hay identidades pendientes de revisión.', 'No identities are awaiting review.')}</p>}
    {requests && requests.length > 0 && <ul className="space-y-3">
      {requests.map(request => <li key={request.requestId} className="space-y-3 rounded-xl border border-white/10 p-3 text-sm break-words">
        <div>
          <h4 className="font-semibold">{t('Participante', 'Participant')}</h4>
          <p>{request.username || '—'}</p>
          <p>{t('Email', 'Email')}: {request.email || '—'}</p>
          <p>{t('Teléfono', 'Phone')}: {request.phone || '—'}</p>
        </div>
        <div>
          <h4 className="font-semibold">{t('Ficha del club', 'Club profile')}</h4>
          <p>{request.customer.name || '—'}</p>
          <p>{t('Email', 'Email')}: {request.customer.email || '—'}</p>
          <p>{t('Teléfono', 'Phone')}: {request.customer.phone || '—'}</p>
        </div>
        {confirmId === request.requestId ? <div className="space-y-2">
          <p>{t('Comprueba con el participante que ambas fichas pertenecen a la misma persona. ¿Confirmas su identidad y la vinculación?', 'Check with the participant that both profiles belong to the same person. Do you confirm their identity and the link?')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busyId !== null || loading} className={actionClass} onClick={() => setConfirmId(null)}>{t('Cancelar', 'Cancel')}</button>
            <button type="button" disabled={busyId !== null || loading} className={actionClass} onClick={() => void approve(request.requestId)}>
              {busyId === request.requestId ? t('Vinculando...', 'Linking...') : t('Confirmar identidad y vincular', 'Confirm identity and link')}
            </button>
          </div>
        </div> : <button type="button" disabled={busyId !== null || loading} className={actionClass} onClick={() => {
          setConfirmId(request.requestId)
          setSuccess(false)
        }}>{t('Revisar identidad', 'Review identity')}</button>}
      </li>)}
    </ul>}
  </section>
}
