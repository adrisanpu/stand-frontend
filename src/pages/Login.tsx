import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  CognitoError,
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  respondNewPassword,
  signIn,
  signUp,
  type CognitoTokens,
} from '../auth/cognitoClient'
import { saveTokens } from '../auth/authStorage'
import { api } from '../api/api'
import { ThemeProvider, useStandLogo } from '../core/theme'

type Mode =
  | 'signIn'
  | 'signUp'
  | 'confirmSignUp'
  | 'forgotPassword'
  | 'confirmForgotPassword'
  | 'newPassword'

export default function Login() {
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/admin/games'
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const standLogo = useStandLogo()

  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [newPasswordSession, setNewPasswordSession] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function finishAuth(tokens: CognitoTokens) {
    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn
    saveTokens({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      expiresAt,
    })
    setAuth(tokens.accessToken)
    void api.post('/v1/user', {}).catch((err) => {
      console.warn('User bootstrap failed (non-blocking):', err)
    })
    navigate(returnUrl, { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signIn') {
        const result = await signIn(email.trim(), password)
        if (result.kind === 'newPasswordRequired') {
          setNewPasswordSession(result.session)
          setMode('newPassword')
          setPassword('')
          setPassword2('')
          setInfo('Debes elegir una nueva contraseña')
          return
        }
        finishAuth(result.tokens)
        return
      }

      if (mode === 'signUp') {
        if (password !== password2) {
          setError('Las contraseñas no coinciden')
          return
        }
        await signUp(email.trim(), password)
        setMode('confirmSignUp')
        setPassword('')
        setPassword2('')
        setInfo('Te enviamos un código a tu email')
        return
      }

      if (mode === 'confirmSignUp') {
        await confirmSignUp(email.trim(), code.trim())
        setMode('signIn')
        setCode('')
        setInfo('Email confirmado. Ya puedes iniciar sesión')
        return
      }

      if (mode === 'forgotPassword') {
        await forgotPassword(email.trim())
        setMode('confirmForgotPassword')
        setInfo('Te enviamos un código para restablecer la contraseña')
        return
      }

      if (mode === 'confirmForgotPassword') {
        if (password !== password2) {
          setError('Las contraseñas no coinciden')
          return
        }
        await confirmForgotPassword(email.trim(), code.trim(), password)
        setMode('signIn')
        setCode('')
        setPassword('')
        setPassword2('')
        setInfo('Contraseña actualizada. Inicia sesión')
        return
      }

      if (mode === 'newPassword') {
        if (!newPasswordSession) {
          setError('Sesión expirada; vuelve a iniciar sesión')
          setMode('signIn')
          return
        }
        if (password !== password2) {
          setError('Las contraseñas no coinciden')
          return
        }
        const tokens = await respondNewPassword(email.trim(), newPasswordSession, password)
        setNewPasswordSession(null)
        finishAuth(tokens)
      }
    } catch (err) {
      if (err instanceof CognitoError) {
        setError(err.message)
        if (err.code === 'UserNotConfirmedException') {
          setMode('confirmSignUp')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'signIn'
      ? 'Iniciar sesión'
      : mode === 'signUp'
        ? 'Crear cuenta'
        : mode === 'confirmSignUp'
          ? 'Confirmar email'
          : mode === 'forgotPassword'
            ? 'Recuperar contraseña'
            : mode === 'confirmForgotPassword'
              ? 'Nueva contraseña'
              : 'Cambiar contraseña'

  return (
    <ThemeProvider game={null}>
      <main className="auth-shell">
        <section className="auth-story" aria-label="STAND">
          <img
            src={standLogo}
            alt="STAND"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (target.src !== `${window.location.origin}/images/logo_stand_letters_white.png`) {
                target.src = '/images/logo_stand_letters_white.png'
              }
            }}
          />
          <div>
            <p className="auth-kicker mb-4 text-sm font-semibold tracking-wide">Experiencias en vivo</p>
            <h2>Tu juego. Tu gente. En directo.</h2>
            <p className="mt-6">Prepara la experiencia, activa el juego y comparte el momento con todo el mundo.</p>
          </div>
        </section>
        <section className="auth-card" aria-labelledby="login-title">
          <div className="flex flex-col items-center space-y-6">
            <h1 id="login-title" className="w-full">{title}</h1>

            <form onSubmit={onSubmit} className="w-full space-y-3">
              {(mode === 'signIn' ||
                mode === 'signUp' ||
                mode === 'confirmSignUp' ||
                mode === 'forgotPassword' ||
                mode === 'confirmForgotPassword' ||
                mode === 'newPassword') && (
                <input
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="Email"
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input p-3"
                  disabled={mode === 'newPassword'}
                />
              )}

              {(mode === 'signIn' || mode === 'signUp') && (
                <input
                  type="password"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  placeholder="Contraseña"
                  aria-label="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input p-3"
                />
              )}

              {mode === 'signUp' && (
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Repetir contraseña"
                  aria-label="Repetir contraseña"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="auth-input p-3"
                />
              )}

              {(mode === 'confirmSignUp' || mode === 'confirmForgotPassword') && (
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="Código"
                  aria-label="Código"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="auth-input p-3"
                />
              )}

              {(mode === 'confirmForgotPassword' || mode === 'newPassword') && (
                <>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Nueva contraseña"
                    aria-label="Nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input p-3"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Repetir contraseña"
                    aria-label="Repetir contraseña"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="auth-input p-3"
                  />
                </>
              )}

              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              {info && <p role="status" className="text-sm text-textSub">{info}</p>}

              <button type="submit" className="auth-submit w-full p-4 font-semibold" disabled={busy}>
                {busy ? 'Espera…' : title}
              </button>
            </form>

            <div className="w-full flex flex-col items-center gap-2">
              {mode === 'signIn' && (
                <>
                  <button type="button" className="auth-link text-sm" onClick={() => { setMode('signUp'); setError(null); setInfo(null) }}>
                    Crear cuenta
                  </button>
                  <button type="button" className="auth-link text-sm" onClick={() => { setMode('forgotPassword'); setError(null); setInfo(null) }}>
                    Olvidé mi contraseña
                  </button>
                </>
              )}
              {mode !== 'signIn' && mode !== 'newPassword' && (
                <button type="button" className="auth-link text-sm" onClick={() => { setMode('signIn'); setError(null); setInfo(null); setCode(''); setPassword2('') }}>
                  Volver a iniciar sesión
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </ThemeProvider>
  )
}
