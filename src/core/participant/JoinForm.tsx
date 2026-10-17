import { useEffect, useRef, useState } from 'react'
import { PublicApiError, publicApi, type EmailChallengeResponse, type EmailRegistration, type PublicGameResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import { PARTICIPANT_PRIVACY_NOTICE, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import { resolveGameAccess } from '../settings/gameAccess'
import { normalizeGameType } from '../gameTypeMap'
import { useParticipantLanguage } from './participantLanguage'
import { resolveParticipantFields } from '../lib/participantFields'
import ParticipantPrizePromo from './ParticipantPrizePromo'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  onJoined: (playerToken: string) => void
}

const verificationErrors: Record<string, string> = {
  VerificationRequired: 'Solicita un código para verificar tu email.',
  InvalidVerificationCode: 'El código no es correcto. Inténtalo de nuevo.',
  VerificationExpired: 'El código ha caducado. Solicita uno nuevo.',
  VerificationAttemptsExceeded: 'Has agotado los 5 intentos. Solicita un código nuevo.',
  VerificationSuperseded: 'Este código ha sido reemplazado. Solicita uno nuevo.',
  VerificationUsed: 'Este código ya se ha utilizado. Solicita uno nuevo.',
  EmailRateLimited: 'Demasiadas solicitudes. Espera antes de solicitar otro código.',
  EmailDeliveryFailed: 'No se pudo enviar el email. Inténtalo de nuevo.',
  VerificationUnavailable: 'La verificación por email no está disponible. Inténtalo más tarde.',
  InvalidJson: 'No se pudo enviar el registro. Revisa tus datos e inténtalo de nuevo.',
  ConsentRequired: 'Debes aceptar la política de privacidad.',
  EmailNotRequested: 'La configuración del formulario ha cambiado. Recarga la página para registrarte.',
  InvalidLanguage: 'No se pudo enviar el registro. Revisa tus datos e inténtalo de nuevo.',
  InvalidGameId: 'No se encuentra el juego. Revisa el enlace de participación.',
  GameNotFound: 'No se encuentra el juego. Revisa el enlace de participación.',
  GameInactive: 'El juego no está activo. Consulta al equipo del evento.',
  web_join_disabled: 'El registro web no está disponible para este juego. Consulta al equipo del evento.',
  unsupported_game_type: 'El registro web no está disponible para este juego. Consulta al equipo del evento.',
  missing_email: 'El email es obligatorio.',
  invalid_email: 'Introduce un email válido.',
  missing_instagram: 'El usuario de Instagram es obligatorio.',
  invalid_instagram: 'Introduce un usuario de Instagram válido.',
  missing_phone: 'El teléfono es obligatorio.',
  invalid_phone: 'Introduce un teléfono válido.',
  player_limit_reached: 'El juego ha alcanzado el límite de participantes. Consulta al equipo del evento.',
}
const invalidChallenges = new Set(['VerificationRequired', 'VerificationExpired', 'VerificationAttemptsExceeded', 'VerificationSuperseded', 'VerificationUsed'])

export default function JoinForm({ gameId, gameMeta, onJoined }: Props) {
  const { language, t } = useParticipantLanguage()
  const pf = resolveParticipantFields(gameMeta.participantFields)
  const emailRequired = pf.email.required
  const igRequired = pf.instagram.required
  const phoneRequired = pf.phone.required

  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<(EmailChallengeResponse & { registration: EmailRegistration }) | null>(null)
  const [code, setCode] = useState('')
  const [invalidChallenge, setInvalidChallenge] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [retryAt, setRetryAt] = useState(0)
  const busy = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    generation.current += 1
    setChallenge(null)
    setCode('')
    setInvalidChallenge(false)
    setError(null)
    setRetryAt(0)
  }, [gameId, emailRequired, igRequired, phoneRequired])

  useEffect(() => {
    if (!challenge && !retryAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [challenge, retryAt])

  const expired = !!challenge && now >= Date.parse(challenge.expiresAt)
  const cooldown = Math.max(0, Math.ceil((Math.max(retryAt, challenge ? Date.parse(challenge.resendAvailableAt) : 0) - now) / 1000))

  const showError = (err: unknown) => {
    if (err instanceof PublicApiError) {
      setError(verificationErrors[err.code ?? ''] ?? 'No se pudo completar el registro. Inténtalo de nuevo más tarde.')
      if (invalidChallenges.has(err.code ?? '')) setInvalidChallenge(true)
      if (err.status === 429 && err.retryAfter) {
        setRetryAt(Date.now() + err.retryAfter * 1000)
        setNow(Date.now())
      }
    } else {
      setError('No se pudo completar el registro. Inténtalo de nuevo más tarde.')
    }
  }

  const requestCode = async (registration: EmailRegistration) => {
    const response = await publicApi.requestEmailCode({ ...registration, consent, language })
    return { ...response, registration }
  }

  const resend = async () => {
    if (!challenge || busy.current || cooldown > 0 || !consent) return
    busy.current = true
    setLoading(true)
    setError(null)
    const version = generation.current
    try {
      const next = await requestCode(challenge.registration)
      if (version !== generation.current) return
      setChallenge(next)
      setRetryAt(Date.parse(next.resendAvailableAt))
      setCode('')
      setInvalidChallenge(false)
      setNow(Date.now())
    } catch (err) {
      if (version === generation.current) showError(err)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy.current) return
    setError(null)
    if (emailRequired && !email.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (igRequired && !instagram.trim()) {
      setError('El usuario de Instagram es obligatorio.')
      return
    }
    if (phoneRequired && !phone.trim()) {
      setError('El teléfono es obligatorio.')
      return
    }
    if (!consent) {
      setError('Debes aceptar la política de privacidad.')
      return
    }
    if (challenge && (expired || invalidChallenge)) return
    if (challenge && !/^[0-9]{6}$/.test(code)) {
      setError('Introduce un código de 6 dígitos.')
      return
    }
    if (!challenge && emailRequired && cooldown > 0) return
    busy.current = true
    setLoading(true)
    const version = generation.current
    try {
      const registration = {
        gameId,
        ...(emailRequired ? { email: email.trim() } : {}),
        ...(igRequired ? { instagram: instagram.trim() } : {}),
        ...(phoneRequired ? { phone: phone.trim() } : {}),
        consent,
      }
      if (emailRequired && !challenge) {
        const next = await requestCode(registration)
        if (version !== generation.current) return
        setChallenge(next)
        setRetryAt(Date.parse(next.resendAvailableAt))
        setCode('')
        setInvalidChallenge(false)
        setNow(Date.now())
        return
      }
      const res = await publicApi.join(challenge
        ? { gameId, challengeId: challenge.challengeId, code }
        : registration)
      if (version !== generation.current) return
      savePlayerSession(gameId, res.playerToken, res.assignment)
      onJoined(res.playerToken)
    } catch (err) {
      if (version === generation.current) showError(err)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center space-y-3">
        <p className="text-sm text-textSub">
          {t(resolveGameAccess(normalizeGameType(gameMeta.gameType), gameMeta).playMode === 'mobile'
            ? 'Regístrate para jugar desde tu móvil'
            : 'Regístrate para jugar en la pantalla máster')}
        </p>
      </div>

      <ParticipantPrizePromo catalog={gameMeta.prizeCatalog} />

      <fieldset disabled={loading || !!challenge} className="space-y-4">
      {emailRequired && <div>
        <label className="block text-sm mb-1" htmlFor="join-email">
          Email *
        </label>
        <input
          id="join-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          placeholder={t('tu@email.com')}
          required={emailRequired}
        />
      </div>}

      {igRequired && <div>
        <label className="block text-sm mb-1" htmlFor="join-ig">
          Instagram *
        </label>
        <input
          id="join-ig"
          type="text"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          placeholder={t('@usuario')}
          required
        />
      </div>}

      {phoneRequired && <div>
        <label className="block text-sm mb-1" htmlFor="join-phone">{t('Teléfono')} *</label>
        <input id="join-phone" type="tel" autoComplete="tel" value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          required />
      </div>}
      </fieldset>

      <label className="flex gap-2 text-xs text-textSub items-start">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          {t(PARTICIPANT_PRIVACY_NOTICE)}{' '}
          <a href={language === 'es' ? PRIVACY_POLICY_URL : '/pages/privacy.html'} target="_blank" rel="noopener noreferrer" className="underline text-accent">
            {t('Política de privacidad')}
          </a>
        </span>
      </label>

      {challenge && <div className="space-y-3">
        <p role="status">{t('Código enviado a')}: {challenge.emailMasked}</p>
        <p className="text-sm text-textSub">{t('El código caduca en 10 minutos. Tienes 5 intentos.')}</p>
        <label className="block text-sm" htmlFor="join-code">{t('Código de verificación')}</label>
        <input id="join-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="one-time-code" value={code} autoFocus
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          disabled={loading || expired || invalidChallenge}
          aria-describedby="join-code-help"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3" required />
        <p id="join-code-help" className="text-sm text-textSub">
          {t(expired ? 'El código ha caducado. Solicita uno nuevo.' : 'Introduce los 6 dígitos del email.')}
        </p>
        <button type="button" onClick={resend} disabled={loading || cooldown > 0 || !consent}
          className="rounded-xl border border-[rgba(var(--color-accent-rgb),0.4)] px-4 py-3 text-accent disabled:opacity-50">
          {t('Reenviar código')}{cooldown > 0 ? ` (${cooldown}s)` : ''}
        </button>
        <button type="button" disabled={loading} onClick={() => {
          generation.current += 1
          setChallenge(null)
          setCode('')
          setInvalidChallenge(false)
          setError(null)
        }} className="rounded-xl px-4 py-3 text-accent disabled:opacity-50">{t('Cambiar datos')}</button>
      </div>}

      {error && <p role="alert" className="text-sm text-red-300">{t(error)}</p>}
      {!challenge && emailRequired && cooldown > 0 && <p role="status" className="text-sm text-textSub">
        {t('Puedes solicitar otro código en')}: {cooldown}s
      </p>}

      <button
        type="submit"
        disabled={loading || (challenge ? expired || invalidChallenge || !consent : emailRequired && cooldown > 0)}
        className="w-full rounded-xl py-3 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.25)] border border-[rgba(var(--color-primary-rgb),0.4)] disabled:opacity-50"
      >
        {t(loading ? (emailRequired && !challenge ? 'Enviando código...' : 'Registrando...')
          : challenge ? 'Verificar y empezar' : emailRequired ? 'Enviar código' : 'Empezar')}
      </button>
    </form>
  )
}
