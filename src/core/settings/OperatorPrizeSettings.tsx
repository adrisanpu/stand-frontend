import { useState, useEffect } from 'react'
import type { GameDefinition } from '../types'
import type { Plan } from '../../auth/featureFlags'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { api } from '../../api/api'
import {
  getOperatorPrizeSlotVisibility,
  readMaxPrizeValidation,
  readMaxPrizeRanking,
  readMaxPrizeRaffle,
} from './operatorPrizeSlots'

interface Empareja2GameResponse {
  ok: boolean
  settings?: { empareja2?: { maxValidations?: number } }
}

type Props = {
  gameId: string
  gameDefinition: GameDefinition
  settings: Record<string, unknown> | null
  plan: Plan | null | undefined
  onPersist: (patch: Record<string, unknown>) => void
}

function readString(s: Record<string, unknown> | null, key: string): string {
  if (!s) return ''
  const v = s[key]
  return typeof v === 'string' ? v : ''
}

function readTopX(s: Record<string, unknown> | null): string {
  if (!s) return '3'
  const v = s.topX
  if (typeof v === 'number' && v >= 1) return String(v)
  return '3'
}

const inputClass =
  'w-full h-11 px-3 sm:px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none min-w-0'
const inputLimitClass =
  'w-full h-11 px-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none sm:text-center'
const colHeaderClass = 'text-xs font-medium text-gray-400'

function PrizeLimitRow({
  textValue,
  onTextChange,
  limitValue,
  onLimitChange,
  textPlaceholder = '🎁 Nombre o descripción del premio',
  limitPlaceholder = '∞',
  showColumnHeaders = false,
}: {
  textValue: string
  onTextChange: (v: string) => void
  limitValue: string
  onLimitChange: (v: string) => void
  textPlaceholder?: string
  limitPlaceholder?: string
  showColumnHeaders?: boolean
}) {
  return (
    <div className="space-y-2">
      {showColumnHeaders && (
        <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_5.75rem] gap-3">
          <span className={colHeaderClass}>Premio</span>
          <span className={`${colHeaderClass} text-center`}>Límite</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.75rem] gap-2 sm:gap-3 items-end">
        <input
          type="text"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={textPlaceholder}
          className={inputClass}
          aria-label="Premio"
        />
        <input
          type="number"
          min={0}
          step={1}
          value={limitValue}
          onChange={(e) => onLimitChange(e.target.value)}
          placeholder={limitPlaceholder}
          className={inputLimitClass}
          aria-label="Límite"
        />
      </div>
    </div>
  )
}

function RankingPrizeRow({
  nameValue,
  onNameChange,
  topXValue,
  onTopXChange,
  limitValue,
  onLimitChange,
}: {
  nameValue: string
  onNameChange: (v: string) => void
  topXValue: string
  onTopXChange: (v: string) => void
  limitValue: string
  onLimitChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_4.75rem_5.75rem] gap-x-3 gap-y-2 items-end">
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium text-gray-400" htmlFor="op-ranking-prize-name">
          Premio
        </label>
        <input
          id="op-ranking-prize-name"
          type="text"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="🎁 Nombre del premio"
          className={inputClass}
        />
      </div>
      <div className="min-w-0 sm:max-w-[4.75rem]">
        <label className="mb-1 block text-xs font-medium text-gray-400" htmlFor="op-ranking-topx">
          Top X
        </label>
        <input
          id="op-ranking-topx"
          type="number"
          min={1}
          max={100}
          step={1}
          value={topXValue}
          onChange={(e) => onTopXChange(e.target.value)}
          placeholder="3"
          className={inputLimitClass}
        />
      </div>
      <div className="min-w-0 sm:max-w-[5.75rem]">
        <label className="mb-1 block text-xs font-medium text-gray-400" htmlFor="op-ranking-limit">
          Límite
        </label>
        <input
          id="op-ranking-limit"
          type="number"
          min={0}
          step={1}
          value={limitValue}
          onChange={(e) => onLimitChange(e.target.value)}
          placeholder="∞"
          className={inputLimitClass}
        />
      </div>
    </div>
  )
}

export default function OperatorPrizeSettings({
  gameId,
  gameDefinition,
  settings,
  plan,
  onPersist,
}: Props) {
  const features = getFeaturesByPlan(plan)
  const slots = getOperatorPrizeSlotVisibility(gameDefinition, features)

  const [prizeRaffleInput, setPrizeRaffleInput] = useState(() => readString(settings, 'prizeRaffle'))
  const [prizeValidationInput, setPrizeValidationInput] = useState(() => readString(settings, 'prizeValidation'))
  const [prizeTopXInput, setPrizeTopXInput] = useState(() => readString(settings, 'prizeTopX'))
  const [topXInput, setTopXInput] = useState(() => readTopX(settings))
  const [maxPrizeValidationInput, setMaxPrizeValidationInput] = useState(() => {
    const m = readMaxPrizeValidation(settings)
    return m != null ? String(m) : ''
  })
  const [maxPrizeRankingInput, setMaxPrizeRankingInput] = useState(() => {
    const m = readMaxPrizeRanking(settings)
    return m != null ? String(m) : ''
  })
  const [maxPrizeRaffleInput, setMaxPrizeRaffleInput] = useState(() => {
    const m = readMaxPrizeRaffle(settings)
    return m != null ? String(m) : ''
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setPrizeRaffleInput(readString(settings, 'prizeRaffle'))
    setPrizeValidationInput(readString(settings, 'prizeValidation'))
    setPrizeTopXInput(readString(settings, 'prizeTopX'))
    setTopXInput(readTopX(settings))
    const mv = readMaxPrizeValidation(settings)
    setMaxPrizeValidationInput(mv != null ? String(mv) : '')
    const mr = readMaxPrizeRanking(settings)
    setMaxPrizeRankingInput(mr != null ? String(mr) : '')
    const mf = readMaxPrizeRaffle(settings)
    setMaxPrizeRaffleInput(mf != null ? String(mf) : '')
  }, [settings])

  useEffect(() => {
    if (gameDefinition.id !== 'empareja2' || !gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<Empareja2GameResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const m = data.settings?.empareja2?.maxValidations
        if (typeof m === 'number' && m >= 0) {
          setMaxPrizeValidationInput(String(m))
        }
      } catch {
        // keep localStorage-driven value
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, gameDefinition.id])

  const parseOptionalMax = (trimmed: string): number | undefined =>
    trimmed === '' ? undefined : Math.max(0, Math.floor(Number(trimmed)) || 0)

  const handleSave = async () => {
    const patch: Record<string, unknown> = {}

    if (slots.validation) {
      patch.prizeValidation = prizeValidationInput.trim() || undefined
      patch.maxPrizeValidation = parseOptionalMax(maxPrizeValidationInput.trim())
      patch.maxValidations = undefined
    }
    if (slots.ranking) {
      const topX = Math.max(1, Math.min(100, Math.floor(Number(topXInput)) || 1))
      patch.topX = topX
      patch.prizeTopX = prizeTopXInput.trim() || undefined
      patch.maxPrizeRanking = parseOptionalMax(maxPrizeRankingInput.trim())
    }
    if (slots.raffle) {
      patch.prizeRaffle = prizeRaffleInput.trim() || undefined
      patch.maxPrizeRaffle = parseOptionalMax(maxPrizeRaffleInput.trim())
    }

    const maxPrizeValidation = patch.maxPrizeValidation as number | undefined

    setSaveStatus('idle')
    setSaveMessage('')

    const runPersist = () => {
      onPersist(patch)
      setSaveStatus('success')
      setSaveMessage('Guardado.')
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 2500)
    }

    if (gameDefinition.id === 'empareja2' && gameId && slots.validation) {
      setSaveStatus('saving')
      setSaveMessage('Guardando...')
      try {
        if (maxPrizeValidation !== undefined) {
          await api.put('/v1/game', {
            gameId,
            settings: {
              empareja2: { maxValidations: maxPrizeValidation },
            },
          })
        }
        runPersist()
      } catch (e: unknown) {
        setSaveStatus('error')
        setSaveMessage(e instanceof Error ? e.message : 'Error al guardar en el servidor')
      }
    } else {
      runPersist()
    }
  }

  const noSlots = !slots.validation && !slots.ranking && !slots.raffle

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Los textos y límites se muestran en el panel del operador (jugadores, ranking, sorteo).
      </p>

      {noSlots && (
        <p className="text-sm text-amber-200/90 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          No hay premios configurables para este juego con tu plan actual (p. ej. el sorteo requiere plan Event 24h).
        </p>
      )}

      <div className="space-y-5">
        {slots.validation && (
          <div className="space-y-2 border-b border-white/10 pb-4">
            <h3 className="text-sm font-medium text-gray-300">Validación / participación</h3>
            <PrizeLimitRow
              showColumnHeaders
              textValue={prizeValidationInput}
              onTextChange={setPrizeValidationInput}
              limitValue={maxPrizeValidationInput}
              onLimitChange={setMaxPrizeValidationInput}
              limitPlaceholder="∞"
            />
            {gameDefinition.id === 'empareja2' && (
              <p className="text-xs text-gray-500">El límite en Empareja2 también se guarda en el servidor.</p>
            )}
          </div>
        )}

        {slots.ranking && (
          <div className="space-y-2 border-b border-white/10 pb-4">
            <h3 className="text-sm font-medium text-gray-300">Ranking</h3>
            <RankingPrizeRow
              nameValue={prizeTopXInput}
              onNameChange={setPrizeTopXInput}
              topXValue={topXInput}
              onTopXChange={setTopXInput}
              limitValue={maxPrizeRankingInput}
              onLimitChange={setMaxPrizeRankingInput}
            />
          </div>
        )}

        {slots.raffle && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300">Sorteo</h3>
            <PrizeLimitRow
              showColumnHeaders
              textValue={prizeRaffleInput}
              onTextChange={setPrizeRaffleInput}
              limitValue={maxPrizeRaffleInput}
              onLimitChange={setMaxPrizeRaffleInput}
              limitPlaceholder="∞"
            />
          </div>
        )}
      </div>

      {saveStatus !== 'idle' && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            saveStatus === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : saveStatus === 'success'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-[rgba(176,38,255,0.15)] text-neonMagenta border-[rgba(176,38,255,0.3)]'
          }`}
        >
          {saveStatus === 'saving' && (
            <span className="inline-block w-3 h-3 rounded-full bg-current animate-pulse mr-2 align-middle" />
          )}
          {saveMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saveStatus === 'saving' || noSlots}
        className="w-full p-3 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveStatus === 'saving' ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
