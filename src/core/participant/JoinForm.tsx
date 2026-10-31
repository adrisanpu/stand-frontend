import { useEffect, useRef, useState } from 'react'
import { PublicApiError, publicApi, type EmailChallengeResponse, type EmailRegistration, type EmailDetailsResponse, type ResumeEmailRequest, type PlayerAssignment, type PublicGameResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import { PARTICIPANT_PRIVACY_NOTICE, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import { useParticipantLanguage } from './participantLanguage'
import { resolveParticipantFields } from '../lib/participantFields'
import { PHONE_COUNTRIES, internationalPhone, splitInternationalPhone, type PhoneCountryCode } from './phoneCountries'

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
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('ES')
  const [consent, setConsent] = useState(false)
  const [clubConsent, setClubConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<(EmailChallengeResponse & { registration: EmailRegistration | ResumeEmailRequest }) | null>(null)
  const [details, setDetails] = useState<EmailDetailsResponse | null>(null)
  const [code, setCode] = useState('')
  const [invalidChallenge, setInvalidChallenge] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [retryAt, setRetryAt] = useState(0)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const busy = useRef(false)
  const generation = useRef(0)
  const regionNames = new Intl.DisplayNames([language], { type: 'region' })
  const countries = [...PHONE_COUNTRIES].sort((a, b) =>
    (regionNames.of(a.code) ?? a.code).localeCompare(regionNames.of(b.code) ?? b.code, language))

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    generation.current += 1
    setChallenge(null)
    setDetails(null)
    setStep(1)
    setCode('')
    setInvalidChallenge(false)
    setError(null)
    setRetryAt(0)
    setClubConsent(false)
  }, [gameId, phoneEnabled, pf.phone.required, gameMeta.loyalty?.consentVersion])

  useEffect(() => () => { generation.current += 1 }, [])

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

  const requestCode = async (registration: EmailRegistration | ResumeEmailRequest) => {
    const response = 'mode' in registration
      ? await publicApi.resumeEmailRegistration({ ...registration, language })
      : await publicApi.requestEmailCode({ ...registration, language })
    if ('detailsRequired' in response) return response
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
    if (!challenge || busy.current || cooldown > 0) return
    busy.current = true
    setLoading(true)
    setError(null)
    const version = generation.current
    try {
      const next = await requestCode(challenge.registration)
      if (version !== generation.current) return
      if ('detailsRequired' in next) {
        setDetails(next)
        setChallenge(null)
        setStep(2)
        return
      }
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
    const fullPhone = internationalPhone(phoneCountry, phone)
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
      if (cooldown > 0) return
      busy.current = true
      setLoading(true)
      const version = generation.current
      try {
        const registration: ResumeEmailRequest = { mode: 'resume', gameId, email: trimmedEmail }
        const response = await publicApi.resumeEmailRegistration({ ...registration, language })
        if (version !== generation.current) return
        if ('detailsRequired' in response) {
          setDetails(response)
          if (response.existingPlayer) setPhoto(null)
          setStep(2)
        } else {
          setDetails(null)
          setPhoto(null)
          setChallenge({ ...response, registration })
          setStep(3)
          setCode('')
          setInvalidChallenge(false)
          setRetryAt(Date.parse(response.resendAvailableAt))
          setNow(Date.now())
        }
      } catch (err) {
        if (version === generation.current) showError(err)
      } finally {
        busy.current = false
        setLoading(false)
      }
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
      if (showName && !trimmedUsername) {
        setError(verificationErrors.missing_username)
        return
      }
      const usernameCharacters = Array.from(trimmedUsername)
      const hasControlCharacter = usernameCharacters.some((character) => {
        const codePoint = character.codePointAt(0)!
        return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
      })
      if (showName && (usernameCharacters.length > 100 || hasControlCharacter)) {
        setError(verificationErrors.invalid_username)
        return
      }
      if (showPhone && pf.phone.required && !phone.trim()) {
        setError(verificationErrors.missing_phone)
        return
      }
      if (showPhone && phone.trim() && (!/^\+?[0-9][0-9 ()-]*$/.test(fullPhone)
        || (phone.match(/[0-9]/g)?.length ?? 0) < 3 || fullPhone.length > 64)) {
        setError(verificationErrors.invalid_phone)
        return
      }
      if (showConsent && !consent) {
        setError('Debes aceptar la política de privacidad.')
        return
      }
      if (showClubConsent && !clubConsent) {
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
      const registration: EmailRegistration | ResumeEmailRequest = details?.existingPlayer ? {
        mode: 'resume',
        gameId, email: email.trim(),
        ...(showName ? { username: trimmedUsername } : {}),
        ...(showPhone ? { phone: fullPhone } : {}),
        ...(showConsent ? { consent } : {}),
        ...(showClubConsent && gameMeta.loyalty ? { loyaltyConsentVersion: gameMeta.loyalty.consentVersion } : {}),
      } : {
        gameId,
        email: email.trim(),
        username: trimmedUsername,
        ...(phoneEnabled && fullPhone ? { phone: fullPhone } : {}),
        consent,
        ...(gameMeta.loyalty ? { loyaltyConsentVersion: gameMeta.loyalty.consentVersion } : {}),
      }
      if (step === 2) {
        const next = await requestCode(registration)
        if (version !== generation.current) return
        if ('detailsRequired' in next) {
          setDetails(next)
          return
        }
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

  const showName = !details?.existingPlayer || details.fields.username
  const showPhone = phoneEnabled && (!details?.existingPlayer || details.fields.phone)
  const showConsent = !details?.existingPlayer || details.fields.consent
  const showClubConsent = !!gameMeta.loyalty && (!details?.existingPlayer || details.fields.loyaltyConsent)

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
      {showName && <div>
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
      </div>}
      {showPhone && <div>
        <label className="block text-sm mb-1" htmlFor="join-phone">{t(pf.phone.required ? 'Teléfono' : 'Teléfono (opcional)')}</label>
        <div className="flex gap-2">
        <select aria-label={t('País y prefijo')} value={phoneCountry}
          onChange={(event) => {
            const selected = PHONE_COUNTRIES.find((item) => item.code === event.target.value)
            if (selected) setPhoneCountry(selected.code)
          }}
          className="min-w-0 w-2/5 rounded-2xl border border-white/20 bg-surface px-2 py-3">
          {countries.map((country) => <option key={country.code} value={country.code}>
            {regionNames.of(country.code) ?? country.code} ({country.prefix})
          </option>)}
        </select>
        <input id="join-phone" type="tel" autoComplete="tel-national" value={phone}
          onChange={(e) => {
            const next = splitInternationalPhone(e.target.value, phoneCountry)
            setPhoneCountry(next.country)
            setPhone(next.number)
          }}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
          maxLength={64} required={pf.phone.required} />
        </div>
      </div>}
      {!details?.existingPlayer && <div>
        <label className="block text-sm mb-1" htmlFor="join-photo">
          {t('Foto de perfil (opcional)')}
        </label>
        <input
          id="join-photo"
          ref={photoInput}
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
          className="sr-only"
        />
        <button type="button" onClick={() => photoInput.current?.click()}
          aria-label={t('Elegir foto de perfil')}
          className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {photoPreview
            ? <img src={photoPreview} alt={t('Vista previa de la foto de perfil')} className="h-full w-full object-cover" />
            : <svg viewBox="0 0 64 64" aria-hidden="true" className="h-20 w-20 text-textSub" fill="currentColor">
                <circle cx="32" cy="22" r="12" />
                <path d="M8 60a24 24 0 0 1 48 0Z" />
              </svg>}
        </button>
        <p className="mt-2 text-center text-xs text-textSub">{t('Pulsa la imagen para elegir tu foto.')}</p>
        {photoError && <p role="alert" className="mt-1 text-xs text-amber-300">{photoError}</p>}
      </div>}

      {showConsent && <label className="flex gap-3 rounded-xl border border-white/10 p-3 text-xs text-textSub items-start">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          {t(PARTICIPANT_PRIVACY_NOTICE)}{' '}
          <a href={language === 'es' ? PRIVACY_POLICY_URL : '/pages/privacy.html'} target="_blank" rel="noopener noreferrer" className="underline text-accent">
            {t('Política de privacidad')}
          </a>
        </span>
      </label>}
      {showClubConsent && gameMeta.loyalty && <label className="flex gap-3 rounded-xl border border-white/10 p-3 text-xs text-textSub items-start">
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
        <button type="button" onClick={resend} disabled={loading || cooldown > 0}
          className="rounded-xl border border-[rgba(var(--color-accent-rgb),0.4)] px-4 py-3 text-accent disabled:opacity-50">
          {t('Reenviar código')}{cooldown > 0 ? ` (${cooldown}s)` : ''}
        </button>
        <div className="flex flex-wrap gap-2">
          {!('mode' in challenge.registration) && <button type="button" disabled={loading} onClick={() => discardChallenge(2)}
            className="rounded-xl px-4 py-3 text-accent disabled:opacity-50">{t('Cambiar datos')}</button>
          }
          <button type="button" disabled={loading} onClick={() => discardChallenge(1)}
            className="rounded-xl px-4 py-3 text-accent disabled:opacity-50">{t('Cambiar email')}</button>
        </div>
      </div>}

      {error && <p role="alert" className="text-sm text-red-300">{t(error)}</p>}
      {step !== 3 && cooldown > 0 && <p role="status" className="text-sm text-textSub">
        {t('Puedes solicitar otro código en')}: {cooldown}s
      </p>}

      {step === 2 && <button type="button" disabled={loading} onClick={() => setStep(1)}
        className="w-full rounded-xl py-3 text-accent disabled:opacity-50">{t('Volver')}</button>}
      <button
        type="submit"
        disabled={loading || (step !== 3 && cooldown > 0) || (step === 3 && (expired || invalidChallenge))}
        className="w-full rounded-2xl py-3.5 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.25)] border border-[rgba(var(--color-primary-rgb),0.4)] disabled:opacity-50"
      >
        {t(loading ? (step !== 3 ? 'Enviando código...' : 'Registrando...')
          : step === 1 ? 'Continuar' : step === 2 ? 'Enviar código' : 'Verificar y empezar')}
      </button>
    </form>
  )
}
