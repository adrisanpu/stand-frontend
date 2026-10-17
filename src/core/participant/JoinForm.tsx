import { useState } from 'react'
import { publicApi, type PublicGameResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import { PARTICIPANT_PRIVACY_NOTICE, PRIVACY_POLICY_URL } from '../ui/gameLegalCopy'
import { resolveGameAccess } from '../settings/gameAccess'
import { normalizeGameType } from '../gameTypeMap'
import { useParticipantLanguage } from './participantLanguage'

type Props = {
  gameId: string
  gameMeta: PublicGameResponse
  onJoined: (playerToken: string) => void
}

export default function JoinForm({ gameId, gameMeta, onJoined }: Props) {
  const { language, t } = useParticipantLanguage()
  const pf = gameMeta.participantFields ?? {}
  const emailRequired = pf.email?.required !== false
  const igRequired = Boolean(pf.instagram?.required)

  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (emailRequired && !email.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (igRequired && !instagram.trim()) {
      setError('El usuario de Instagram es obligatorio.')
      return
    }
    if (!consent) {
      setError('Debes aceptar la política de privacidad.')
      return
    }
    setLoading(true)
    try {
      const res = await publicApi.join({
        gameId,
        email: email.trim(),
        instagram: instagram.trim() || undefined,
        consent: true,
      })
      savePlayerSession(gameId, res.playerToken, res.assignment)
      onJoined(res.playerToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
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

      <div>
        <label className="block text-sm mb-1" htmlFor="join-email">
          Email{emailRequired ? ' *' : ''}
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
      </div>

      <div>
        <label className="block text-sm mb-1" htmlFor="join-ig">
          Instagram{igRequired ? ' *' : t(' (opcional)')}
        </label>
        <input
          id="join-ig"
          type="text"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          placeholder={t('@usuario')}
        />
      </div>

      <label className="flex gap-2 text-xs text-textSub items-start">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          {t(PARTICIPANT_PRIVACY_NOTICE)}{' '}
          <a href={language === 'es' ? PRIVACY_POLICY_URL : '/pages/privacy.html'} target="_blank" rel="noopener noreferrer" className="underline text-accent">
            {t('Política de privacidad')}
          </a>
        </span>
      </label>

      {error && <p className="text-sm text-red-300">{t(error)}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.25)] border border-[rgba(var(--color-primary-rgb),0.4)] disabled:opacity-50"
      >
        {t(loading ? 'Registrando...' : 'Empezar')}
      </button>
    </form>
  )
}
