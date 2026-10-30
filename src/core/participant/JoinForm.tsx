import { useEffect, useRef, useState } from 'react'
import { PublicApiError, publicApi, type EmailChallengeResponse, type EmailRegistration, type PlayerAssignment, type PublicGameResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import { PARTICIPANT_PRIVACY_NOTICE, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import { useParticipantLanguage } from './participantLanguage'
import { resolveParticipantFields } from '../lib/participantFields'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  onJoined: (playerToken: string, photoUploadFailed?: boolean) => void
}

const verificationErrors: Record<string, string> = {
  KivlyConsentRequired: 'Debes aceptar las condiciones del club para jugar. Si han cambiado, recarga la página.',
  KivlyMembershipRequired: 'Completa el registro en el club antes de jugar.',
  KivlyRegistrationBusy: 'Se está confirmando tu alta en el club. Espera y reintenta con el mismo código.',
  KivlyReconciliationRequired: 'Tu alta está pendiente de comprobación. Consulta al equipo del evento; no vuelvas a registrarte.',
  KivlyRateLimited: 'El club está recibiendo demasiadas solicitudes. Espera y reintenta con el mismo código.',
  KivlyUnavailable: 'No se pudo confirmar el alta en el club. Reintenta con el mismo código.',
  KivlyRequestFailed: 'No se pudo confirmar el alta en el club. Reintenta con el mismo código.',
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
  invalid_username: 'Usa un nombre completo de hasta 100 caracteres sin caracteres de control.',
  missing_username: 'El nombre completo es obligatorio.',
  missing_phone: 'El teléfono es obligatorio.',
  invalid_phone: 'Introduce un teléfono válido.',
  player_limit_reached: 'El juego ha alcanzado el límite de participantes. Consulta al equipo del evento.',
}
const invalidChallenges = new Set(['VerificationRequired', 'VerificationExpired', 'VerificationAttemptsExceeded', 'VerificationSuperseded', 'VerificationUsed'])

export default function JoinForm({ gameId, gameMeta, onJoined }: Props) {
  const { language, t } = useParticipantLanguage()
  const pf = resolveParticipantFields(gameMeta.participantFields, gameMeta.gameType)
  const phoneEnabled = pf.phone.enabled

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [clubConsent, setClubConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<(EmailChallengeResponse & { registration: EmailRegistration }) | null>(null)
  const [code, setCode] = useState('')
  const [invalidChallenge, setInvalidChallenge] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [retryAt, setRetryAt] = useState(0)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const busy = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    generation.current += 1
    setChallenge(null)
    setStep(1)
    setCode('')
    setInvalidChallenge(false)
    setError(null)
    setRetryAt(0)
    setClubConsent(false)
  }, [gameId, phoneEnabled, gameMeta.loyalty?.consentVersion])

  useEffect(() => {
    if (!challenge && !retryAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [challenge, retryAt])

  const expired = !!challenge && now >= Date.parse(challenge.expiresAt)
  const cooldown = Math.max(0, Math.ceil((Math.max(retryAt, challenge ? Date.parse(challenge.resendAvailableAt) : 0) - now) / 1000))

  const continueToGame = (playerToken: string, assignment: PlayerAssignment, photoUploadFailed = false) => {
    savePlayerSession(gameId, playerToken, assignment)
    if (photoUploadFailed) onJoined(playerToken, true)
    else onJoined(playerToken)
  }

  const showError = (err: unknown) => {
    if (err instanceof PublicApiError) {
      setError(verificationErrors[err.code ?? ''] ?? (err.code?.startsWith('Kivly')
        ? 'No se pudo confirmar tu registro en el club. Consulta al equipo del evento.'
        : 'No se pudo completar el registro. Inténtalo de nuevo más tarde.'))
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

  const discardChallenge = (nextStep: number) => {
    generation.current += 1
    setChallenge(null)
    setCode('')
    setInvalidChallenge(false)
    setError(null)
    setRetryAt(0)
    setStep(nextStep)
  }

  const resend = async () => {
    if (!challenge || busy.current || cooldown > 0 || !consent || (gameMeta.loyalty && !clubConsent)) return
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
    const trimmedUsername = username.trim()
    if (step === 1) {
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        setError(verificationErrors.missing_email)
        return
      }
      if (!/^[^\s@]+@[^\s@]+$/.test(trimmedEmail)) {
        setError(verificationErrors.invalid_email)
        return
      }
      setEmail(trimmedEmail)
      setStep(2)
      return
    }
    if (step === 2) {
      if (!email.trim()) {
        setError(verificationErrors.missing_email)
        setStep(1)
        return
      }
      if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
        setError(verificationErrors.invalid_email)
        setStep(1)
        return
      }
      if (!trimmedUsername) {
        setError(verificationErrors.missing_username)
        return
      }
      const usernameCharacters = Array.from(trimmedUsername)
      const hasControlCharacter = usernameCharacters.some((character) => {
        const codePoint = character.codePointAt(0)!
        return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
      })
      if (usernameCharacters.length > 100 || hasControlCharacter) {
        setError(verificationErrors.invalid_username)
        return
      }
      if (pf.phone.required && !phone.trim()) {
        setError(verificationErrors.missing_phone)
        return
      }
      if (pf.phone.required && (!/^\+?[0-9][0-9 ()-]*$/.test(phone.trim())
        || (phone.match(/[0-9]/g)?.length ?? 0) < 3 || phone.trim().length > 64)) {
        setError(verificationErrors.invalid_phone)
        return
      }
      if (!consent) {
        setError('Debes aceptar la política de privacidad.')
        return
      }
      if (gameMeta.loyalty && !clubConsent) {
        setError(verificationErrors.KivlyConsentRequired)
        return
      }
      if (cooldown > 0) return
    }
    if (step === 3 && (!challenge || expired || invalidChallenge)) return
    if (step === 3 && !/^[0-9]{6}$/.test(code)) {
      setError('Introduce un código de 6 dígitos.')
      return
    }
    busy.current = true
    setLoading(true)
    const version = generation.current
    try {
      const registration = {
        gameId,
        email: email.trim(),
        username: trimmedUsername,
        ...(phoneEnabled && phone.trim() ? { phone: phone.trim() } : {}),
        consent,
        ...(gameMeta.loyalty ? { loyaltyConsentVersion: gameMeta.loyalty.consentVersion } : {}),
      }
      if (step === 2) {
        const next = await requestCode(registration)
        if (version !== generation.current) return
        setChallenge(next)
        setStep(3)
        setRetryAt(Date.parse(next.resendAvailableAt))
        setCode('')
        setInvalidChallenge(false)
        setNow(Date.now())
        return
      }
      if (!challenge) return
      const res = await publicApi.join({ gameId, challengeId: challenge.challengeId, code })
      if (version !== generation.current) return
      let assignment = res.assignment
      if (photo) {
        try {
          const profilePicUrl = await publicApi.uploadParticipantPhoto(photo, res.playerToken)
          if (version !== generation.current) return
          assignment = { ...assignment, profilePicUrl }
        } catch {
          if (version !== generation.current) return
          continueToGame(res.playerToken, assignment, true)
          return
        }
      }
      continueToGame(res.playerToken, assignment)
    } catch (err) {
      if (version === generation.current) showError(err)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {step === 1 && <>
      <div>
        <label className="block text-sm mb-1" htmlFor="join-email">
          Email *
        </label>
        <input
          id="join-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
          placeholder={t('tu@email.com')}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-textSub">{t('Te enviaremos un código para confirmar tu email.')}</p>
      </div>
      </>}

      {step === 2 && <>
      <fieldset disabled={loading} className="space-y-4">
      <div>
        <label className="block text-sm mb-1" htmlFor="join-username">
          {t('Nombre completo')} *
        </label>
        <input
          id="join-username"
          type="text"
          autoComplete="name"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
        />
        <p className="mt-1 text-xs text-textSub">{t('Usa el nombre con el que quieres aparecer en el juego.')}</p>
      </div>
      {phoneEnabled && <div>
        <label className="block text-sm mb-1" htmlFor="join-phone">{t(pf.phone.required ? 'Teléfono' : 'Teléfono (opcional)')}</label>
        <input id="join-phone" type="tel" autoComplete="tel" value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
          maxLength={64} required={pf.phone.required} />
      </div>}
      <div>
        <label className="block text-sm mb-1" htmlFor="join-photo">
          {t('Foto de perfil (opcional)')}
        </label>
        <input
          id="join-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null
            if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
              || file.size <= 0 || file.size > 5 * 1024 * 1024)) {
              setPhoto(null)
              setPhotoError(t('Usa una imagen JPG, PNG o WebP de hasta 5 MB.'))
              event.currentTarget.value = ''
              return
            }
            setPhoto(file)
            setPhotoError(null)
          }}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
        />
        {photoError && <p role="alert" className="mt-1 text-xs text-amber-300">{photoError}</p>}
      </div>

      <label className="flex gap-3 rounded-xl border border-white/10 p-3 text-xs text-textSub items-start">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          {t(PARTICIPANT_PRIVACY_NOTICE)}{' '}
          <a href={language === 'es' ? PRIVACY_POLICY_URL : '/pages/privacy.html'} target="_blank" rel="noopener noreferrer" className="underline text-accent">
            {t('Política de privacidad')}
          </a>
        </span>
      </label>
      {gameMeta.loyalty && <label className="flex gap-3 rounded-xl border border-white/10 p-3 text-xs text-textSub items-start">
        <input type="checkbox" checked={clubConsent} onChange={(event) => setClubConsent(event.target.checked)} className="mt-1" required />
        <span>{t('Acepto registrarme en el club')} <strong>{gameMeta.loyalty.clubName}</strong>.{' '}
          {t('Acepto las condiciones y la política de privacidad del club. El registro es necesario para jugar.')}{' '}
          {phoneEnabled && <>{t(pf.phone.required
            ? 'Tu teléfono se compartirá con el club al crear tu ficha.'
            : 'Si añades tu teléfono, también se compartirá con el club al crear tu ficha.')}{' '}</>}
          <a href={gameMeta.loyalty.termsUrl} target="_blank" rel="noopener noreferrer" className="underline text-accent">{t('Condiciones del club')}</a>{' · '}
          <a href={gameMeta.loyalty.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline text-accent">{t('Privacidad del club')}</a>
        </span>
      </label>}
      </fieldset>
      </>}

      {step === 3 && challenge && <div className="space-y-3">
        <p role="status">{t('Código enviado a')}: {challenge.emailMasked}</p>
        <p className="text-sm text-textSub">{t('El código caduca en 10 minutos. Tienes 5 intentos.')}</p>
        <label className="block text-sm" htmlFor="join-code">{t('Código de verificación')}</label>
        <input id="join-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="one-time-code" value={code} autoFocus
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          disabled={loading || expired || invalidChallenge}
          aria-describedby="join-code-help"
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3" required />
        <p id="join-code-help" className="text-sm text-textSub">
          {t(expired ? 'El código ha caducado. Solicita uno nuevo.' : 'Introduce los 6 dígitos del email.')}
        </p>
        <button type="button" onClick={resend} disabled={loading || cooldown > 0 || !consent || (gameMeta.loyalty != null && !clubConsent)}
          className="rounded-xl border border-[rgba(var(--color-accent-rgb),0.4)] px-4 py-3 text-accent disabled:opacity-50">
          {t('Reenviar código')}{cooldown > 0 ? ` (${cooldown}s)` : ''}
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading} onClick={() => discardChallenge(2)}
            className="rounded-xl px-4 py-3 text-accent disabled:opacity-50">{t('Cambiar datos')}</button>
          <button type="button" disabled={loading} onClick={() => discardChallenge(1)}
            className="rounded-xl px-4 py-3 text-accent disabled:opacity-50">{t('Cambiar email')}</button>
        </div>
      </div>}

      {error && <p role="alert" className="text-sm text-red-300">{t(error)}</p>}
      {step === 2 && cooldown > 0 && <p role="status" className="text-sm text-textSub">
        {t('Puedes solicitar otro código en')}: {cooldown}s
      </p>}

      {step === 2 && <button type="button" disabled={loading} onClick={() => setStep(1)}
        className="w-full rounded-xl py-3 text-accent disabled:opacity-50">{t('Volver')}</button>}
      <button
        type="submit"
        disabled={loading || (step === 2 && cooldown > 0) || (step === 3 && (expired || invalidChallenge || !consent || (gameMeta.loyalty != null && !clubConsent)))}
        className="w-full rounded-2xl py-3.5 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.25)] border border-[rgba(var(--color-primary-rgb),0.4)] disabled:opacity-50"
      >
        {t(loading ? (step === 2 ? 'Enviando código...' : 'Registrando...')
          : step === 1 ? 'Continuar' : step === 2 ? 'Enviar código' : 'Verificar y empezar')}
      </button>
    </form>
  )
}
