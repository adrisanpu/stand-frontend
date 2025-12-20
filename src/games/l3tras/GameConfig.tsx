import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'

export type L3trasSettings = {
  objectiveWord: string
  normalize: 'UPPER' | 'LOWER'
}

const DEFAULT_SETTINGS: L3trasSettings = {
  objectiveWord: 'STAND',
  normalize: 'UPPER',
}

export default function L3trasGameConfig({ gameName, settings, onChange }: GameConfigProps) {
  const [objectiveWord, setObjectiveWord] = useState<string>(
    (settings as L3trasSettings | null)?.objectiveWord || DEFAULT_SETTINGS.objectiveWord
  )
  const [normalize, setNormalize] = useState<'UPPER' | 'LOWER'>(
    (settings as L3trasSettings | null)?.normalize || DEFAULT_SETTINGS.normalize
  )

  useEffect(() => {
    if (settings) {
      const s = settings as L3trasSettings
      setObjectiveWord(s.objectiveWord || DEFAULT_SETTINGS.objectiveWord)
      setNormalize(s.normalize || DEFAULT_SETTINGS.normalize)
    }
  }, [settings])

  const handleObjectiveWordChange = (value: string) => {
    // Only allow letters A-Z, strip spaces and accents
    const cleaned = value.replace(/[^A-Za-z]/g, '').toUpperCase()
    setObjectiveWord(cleaned)
  }

  const handleSave = () => {
    if (!objectiveWord || objectiveWord.length === 0) {
      alert('La palabra objetivo no puede estar vacía')
      return
    }

    const newSettings: L3trasSettings = {
      objectiveWord: normalize === 'UPPER' ? objectiveWord.toUpperCase() : objectiveWord.toLowerCase(),
      normalize,
    }
    onChange(newSettings)
  }

  const normalizedWord = normalize === 'UPPER' ? objectiveWord.toUpperCase() : objectiveWord.toLowerCase()
  const letterCount = normalizedWord.length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configurar {gameName}</h3>
        <p className="text-sm text-gray-400">
          Define la palabra objetivo que los jugadores deben formar con sus letras
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Palabra objetivo
          </label>
          <input
            type="text"
            value={objectiveWord}
            onChange={(e) => handleObjectiveWordChange(e.target.value)}
            placeholder="STAND"
            className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none uppercase"
          />
          <p className="text-xs text-gray-400 mt-1">
            Solo se permiten letras (A-Z). Los espacios y caracteres especiales se eliminarán automáticamente.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Normalización
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setNormalize('UPPER')}
              className={`flex-1 p-3 rounded-xl border transition-colors ${
                normalize === 'UPPER'
                  ? 'bg-[rgba(16,185,129,0.2)] border-[rgba(16,185,129,0.3)] text-[#10B981]'
                  : 'bg-[rgba(255,255,255,0.05)] border-white/10 hover:bg-[rgba(255,255,255,0.1)]'
              }`}
            >
              MAYÚSCULAS
            </button>
            <button
              onClick={() => setNormalize('LOWER')}
              className={`flex-1 p-3 rounded-xl border transition-colors ${
                normalize === 'LOWER'
                  ? 'bg-[rgba(16,185,129,0.2)] border-[rgba(16,185,129,0.3)] text-[#10B981]'
                  : 'bg-[rgba(255,255,255,0.05)] border-white/10 hover:bg-[rgba(255,255,255,0.1)]'
              }`}
            >
              minúsculas
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-4 rounded-xl bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)]">
          <p className="text-sm text-gray-300 mb-2">Vista previa:</p>
          <p className="text-lg font-semibold text-[#10B981] mb-1">
            Palabra objetivo: {normalizedWord.split('').join(' ')} ({letterCount} letras)
          </p>
          <p className="text-xs text-gray-400">
            Se requerirán {letterCount} código{letterCount !== 1 ? 's' : ''} de validación
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full p-3 rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.3)] transition-colors font-medium"
      >
        Guardar configuración
      </button>
    </div>
  )
}

