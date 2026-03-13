import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'

export type T1merSettings = {
  topX?: number
  prizeTopX?: string
  prizeRaffle?: string
}

export default function T1merGameConfig({ gameId: _gameId, gameName: _gameName, settings, onChange }: GameConfigProps) {
  const [topXInput, setTopXInput] = useState<string>(
    (settings as T1merSettings | null)?.topX != null
      ? String((settings as T1merSettings).topX)
      : '3'
  )
  const [prizeTopXInput, setPrizeTopXInput] = useState<string>(
    (settings as T1merSettings | null)?.prizeTopX ?? ''
  )
  const [prizeRaffleInput, setPrizeRaffleInput] = useState<string>(
    (settings as T1merSettings | null)?.prizeRaffle ?? ''
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    if (settings) {
      const s = settings as T1merSettings
      setTopXInput(s.topX != null ? String(s.topX) : '3')
      setPrizeTopXInput(s.prizeTopX ?? '')
      setPrizeRaffleInput(s.prizeRaffle ?? '')
    }
  }, [settings])

  const handleSave = () => {
    const topX = Math.max(1, Math.min(100, Math.floor(Number(topXInput)) || 1))
    const newSettings: T1merSettings = {
      topX,
      prizeTopX: prizeTopXInput.trim() || undefined,
      prizeRaffle: prizeRaffleInput.trim() || undefined,
    }
    onChange(newSettings)
    setTopXInput(String(topX))
    setSaveStatus('success')
    setSaveMessage('Configuración guardada.')
    setTimeout(() => {
      setSaveStatus('idle')
      setSaveMessage('')
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="border-b border-white/10 pb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Premios</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Top X (puestos con premio)</label>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={topXInput}
                onChange={(e) => setTopXInput(e.target.value)}
                placeholder="3"
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Número de primeros puestos del ranking que obtienen premio</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Premio por quedar en el top X</label>
              <input
                type="text"
                value={prizeTopXInput}
                onChange={(e) => setPrizeTopXInput(e.target.value)}
                placeholder="🎁 Descripción del premio"
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Premio por ganar sorteo</label>
              <input
                type="text"
                value={prizeRaffleInput}
                onChange={(e) => setPrizeRaffleInput(e.target.value)}
                placeholder="🎁 Descripción del premio"
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {saveStatus !== 'idle' && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            saveStatus === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : saveStatus === 'success'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-[rgba(239,68,68,0.15)] text-red-300 border-[rgba(239,68,68,0.3)]'
          }`}
        >
          {saveMessage}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
        className="w-full p-3 rounded-xl bg-[rgba(239,68,68,0.2)] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.3)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Guardar configuración
      </button>
    </div>
  )
}
