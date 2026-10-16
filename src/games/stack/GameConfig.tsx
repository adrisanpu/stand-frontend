import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import type { GameConfigProps } from '../../core/types'
import { DEFAULT_STACK_CONFIG, isStackConfig, type StackConfig } from './stackLogic'

const FIELDS = [
  { key: 'initialSpeed', label: 'Velocidad inicial', min: 0.1, step: 0.1 },
  { key: 'speedIncrement', label: 'Incremento por pizza', min: 0, step: 0.01 },
  { key: 'maxSpeed', label: 'Velocidad máxima', min: 0.1, step: 0.1 },
  { key: 'perfectTolerance', label: 'Tolerancia Perfect', min: 0, step: 0.01 },
] as const

export default function StackGameConfig({ gameId, onChange }: GameConfigProps) {
  const [config, setConfig] = useState<StackConfig>(DEFAULT_STACK_CONFIG)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!gameId) {
      setStatus('ready')
      return
    }
    setStatus('loading')
    void api.get<{ game?: { type?: { STACK?: unknown } } }>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
      .then((data) => {
        if (cancelled) return
        if (!isStackConfig(data.game?.type?.STACK)) throw new Error('El servidor no devolvió una configuración válida de STACK.')
        setConfig(data.game.type.STACK)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setStatus('error')
        setMessage(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
      })
    return () => { cancelled = true }
  }, [gameId])

  const save = async () => {
    if (!gameId || !isStackConfig(config)) {
      setMessage('Revisa las velocidades y la tolerancia antes de guardar.')
      return
    }
    setStatus('saving')
    setMessage('')
    try {
      const settings = {
        initialSpeed: config.initialSpeed,
        speedIncrement: config.speedIncrement,
        maxSpeed: config.maxSpeed,
        perfectTolerance: config.perfectTolerance,
      }
      await api.put('/v1/game', { gameId, settings: { stack: settings } })
      onChange(settings)
      setStatus('saved')
      setMessage('Configuración guardada. Se aplicará a los nuevos intentos.')
    } catch (cause) {
      setStatus('ready')
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-xl">STACK · Móviles</h2>
      <p className="text-sm text-textSub">Un único intento por participante, consumido al empezar. Juego móvil en desarrollo.</p>
      {status === 'loading' && <p role="status">Cargando configuración...</p>}
      {FIELDS.map(({ key, label, min, step }) => (
        <label key={key} className="block space-y-1">
          <span className="text-sm">{label}</span>
          <input
            type="number"
            min={min}
            step={step}
            value={Number.isFinite(config[key]) ? config[key] : ''}
            disabled={status === 'loading' || status === 'error' || status === 'saving'}
            onChange={(event) => {
              setConfig({ ...config, [key]: event.target.valueAsNumber })
              setMessage('')
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3"
          />
        </label>
      ))}
      {message && <p role={status === 'saved' ? 'status' : 'alert'} className="text-sm">{message}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!gameId || status === 'loading' || status === 'error' || status === 'saving' || !isStackConfig(config)}
        className="w-full rounded-xl py-3 font-semibold bg-primary/20 border border-primary/30 disabled:opacity-50"
      >
        {status === 'saving' ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
