import { useState } from 'react'
import { publicApi } from '../../api/publicApi'
import { loadAssignment, savePlayerSession } from './playerSession'
import { useParticipantLanguage } from './participantLanguage'

type Props = {
  gameId: string
  playerToken: string
  onResult: () => void
  onBack: () => void
}

export default function ValidateView({ gameId, playerToken, onResult, onBack }: Props) {
  const { t } = useParticipantLanguage()
  const ownAssignment = loadAssignment(gameId)
  const characters = ownAssignment && 'characterName' in ownAssignment ? ownAssignment : null
  const own = ownAssignment && 'validationCode' in ownAssignment ? ownAssignment.validationCode : undefined
  const code1 = own == null ? '' : String(own)
  const [code2, setCode2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const codes = [code1.trim(), code2.trim()].filter(Boolean)
    if (codes.length !== 2) {
      setError('Introduce los dos códigos de la pareja.')
      return
    }
    setLoading(true)
    try {
      const res = await publicApi.validate({ gameId, playerToken, codes })
      if (!res.valid) {
        setError(res.message || 'No sois la pareja correcta.')
        return
      }
      const assignment = loadAssignment(gameId)
      if (assignment) {
        savePlayerSession(gameId, playerToken, { ...assignment, validated: true })
      }
      onResult()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al validar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{t('Validar pareja')}</h2>
        <p className="text-sm text-textSub">{t('Muestra tu código e introduce el de tu pareja cuando os encontréis')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          {characters?.characterImageUrl && (
            <img
              src={characters.characterImageUrl}
              alt={characters.characterName}
              className="mx-auto h-16 w-16 rounded-xl bg-white/5 object-contain"
            />
          )}
          <p className="text-sm text-textSub">{t('Tu código')}</p>
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-2xl font-mono">
            {code1 || t('No disponible')}
          </p>
        </div>
        <div className="space-y-1">
          {characters?.partnerCharacterImageUrl && (
            <img
              src={characters.partnerCharacterImageUrl}
              alt={characters.partnerCharacterName}
              className="mx-auto h-16 w-16 rounded-xl bg-white/5 object-contain"
            />
          )}
          <label htmlFor="partner-code" className="block text-sm text-textSub">{t('Código de tu pareja')}</label>
          <input
            id="partner-code"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code2}
            onChange={(e) => setCode2(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-2xl font-mono"
            placeholder="0000"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-300 text-center">{t(error)}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3 font-semibold text-primary bg-[rgba(var(--color-primary-rgb),0.25)] border border-[rgba(var(--color-primary-rgb),0.4)] disabled:opacity-50"
      >
        {t(loading ? 'Validando...' : 'Validar')}
      </button>

      <button type="button" onClick={onBack} className="w-full text-sm text-accent underline">
        {t('Volver')}
      </button>
    </form>
  )
}
