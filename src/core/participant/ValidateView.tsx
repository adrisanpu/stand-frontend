import { useState } from 'react'
import { publicApi } from '../../api/publicApi'
import { loadAssignment, savePlayerSession } from './playerSession'

type Props = {
  gameId: string
  playerToken: string
  onResult: () => void
  onBack: () => void
}

export default function ValidateView({ gameId, playerToken, onResult, onBack }: Props) {
  const ownAssignment = loadAssignment(gameId)
  const own = ownAssignment && 'validationCode' in ownAssignment ? ownAssignment.validationCode : undefined
  const [code1, setCode1] = useState(own ? String(own) : '')
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
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Validar pareja</h2>
        <p className="text-sm text-textSub">Introduce los dos códigos cuando os encontréis</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code1}
          onChange={(e) => setCode1(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-2xl font-mono"
          placeholder="0000"
          aria-label="Código 1"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code2}
          onChange={(e) => setCode2(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-2xl font-mono"
          placeholder="0000"
          aria-label="Código 2"
        />
      </div>

      {error && <p className="text-sm text-red-300 text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3 font-semibold bg-[rgba(176,38,255,0.25)] border border-[rgba(176,38,255,0.4)] disabled:opacity-50"
      >
        {loading ? 'Validando...' : 'Validar'}
      </button>

      <button type="button" onClick={onBack} className="w-full text-sm text-textSub underline">
        Volver
      </button>
    </form>
  )
}
