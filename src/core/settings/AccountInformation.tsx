import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import type { User } from '../../auth/useCurrentUser'
import { useOperatorLanguage } from '../shell/operatorLanguage'

function Countdown({ targetDate }: { targetDate: string }) {
  const { t } = useOperatorLanguage()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const difference = new Date(targetDate).getTime() - now
  if (!Number.isFinite(difference)) return <span>{t('No disponible', 'Not available')}</span>
  if (difference <= 0) return <span>{t('Expirado', 'Expired')}</span>
  const seconds = Math.floor(difference / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  return <span>{days > 0 ? `${days}d ` : ''}{days > 0 || hours > 0 ? `${hours}h ` : ''}{days > 0 || hours > 0 || minutes > 0 ? `${minutes}m ` : ''}{seconds % 60}s</span>
}

export default function AccountInformation({ user, loading = false, showEmail = true }: {
  user: User | null
  loading?: boolean
  showEmail?: boolean
}) {
  const { language, t } = useOperatorLanguage()
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState(false)
  const formatDate = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null
    return date && Number.isFinite(date.getTime())
      ? date.toLocaleString(language === 'en' ? 'en-US' : 'es-ES', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }) : t('No disponible', 'Not available')
  }
  async function startCheckout() {
    setStartingCheckout(true)
    setCheckoutError(false)
    try {
      const data = await api.post<{ checkoutUrl: string }>('/v1/billing/checkout', {})
      if (!data.checkoutUrl) throw new Error('No checkout URL received')
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      console.error('Error starting checkout', error)
      setCheckoutError(true)
      setStartingCheckout(false)
    }
  }
  if (loading) return <p role="status">{t('Cargando información...', 'Loading information...')}</p>
  if (!user) return <p role="alert">{t('No se pudo cargar la información del usuario', 'Could not load user information')}</p>
  const planLabels = { free: t('Gratis', 'Free'), event: t('Evento 24h', 'Event 24h'), enterprise: 'Enterprise' }
  return (
    <section aria-label={t('Información de la cuenta', 'Account information')} className="space-y-5">
      <dl className="grid gap-5 sm:grid-cols-2">
        {showEmail && <div><dt className="text-sm text-textSub">Email</dt><dd className="mt-1 break-words">{user.email || t('No disponible', 'Not available')}</dd></div>}
        <div><dt className="text-sm text-textSub">{t('Plan', 'Plan')}</dt><dd className="mt-1 font-medium">{planLabels[user.plan]}</dd></div>
        {user.activeUntil && <div>
          <dt className="text-sm text-textSub">{t('Activo hasta', 'Active until')}</dt>
          <dd className="mt-1 space-y-1">
            <time dateTime={user.activeUntil} className="block">{formatDate(user.activeUntil)}</time>
            <span className="block text-sm text-textSub"><Countdown targetDate={user.activeUntil} /></span>
          </dd>
        </div>}
        <div><dt className="text-sm text-textSub">{t('Cuenta creada', 'Account created')}</dt>
          <dd className="mt-1 text-sm">{formatDate(user.createdAt)}</dd></div>
        {user.updatedAt && user.updatedAt !== user.createdAt && <div>
          <dt className="text-sm text-textSub">{t('Última actualización', 'Last updated')}</dt>
          <dd className="mt-1 text-sm">{formatDate(user.updatedAt)}</dd>
        </div>}
      </dl>
      {user.plan === 'free' && <div className="space-y-3">
        <p className="text-sm text-textSub">{t('Actualiza a Event 24h para desbloquear todas las funciones', 'Upgrade to Event 24h to unlock all features')}</p>
        <button type="button" onClick={startCheckout} disabled={startingCheckout}
          className="rounded-xl border border-primary/40 bg-primary/20 px-4 py-2 font-medium disabled:opacity-50">
          {startingCheckout ? t('Procesando...', 'Processing...') : t('Activar 24h', 'Activate 24h')}
        </button>
        {checkoutError && <p role="alert" className="text-red-400">{t('Error al iniciar el pago. Por favor, intenta de nuevo.', 'Error starting checkout. Please try again.')}</p>}
      </div>}
    </section>
  )
}
