import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'

export type Rulet4PanelConfig = {
  id: string
  label: string
  color?: string
  count: number // number of panels of this type (weights/probability)
}

export type Rulet4Settings = {
  panels: Rulet4PanelConfig[]
}

const DEFAULT_PANELS: Rulet4PanelConfig[] = [
  { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
  { id: '2', label: 'Negro', color: '#000000', count: 4 },
  { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
]

export default function Rulet4GameConfig({ gameName, settings, onChange }: GameConfigProps) {
  const [panels, setPanels] = useState<Rulet4PanelConfig[]>(
    (settings as Rulet4Settings | null)?.panels || DEFAULT_PANELS
  )

  useEffect(() => {
    if (settings) {
      setPanels((settings as Rulet4Settings).panels || DEFAULT_PANELS)
    }
  }, [settings])

  const handleAddPanel = () => {
    const newId = String(Date.now())
    const newPanel: Rulet4PanelConfig = {
      id: newId,
      label: `Premio ${panels.length + 1}`,
      color: '#DC2626',
      count: 1,
    }
    setPanels([...panels, newPanel])
  }

  const handleDeletePanel = (id: string) => {
    if (panels.length > 1) {
      setPanels(panels.filter(p => p.id !== id))
    }
  }

  const handlePanelChange = (id: string, field: keyof Rulet4PanelConfig, value: string | number) => {
    setPanels(panels.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  const handleSave = () => {
    const newSettings: Rulet4Settings = { panels }
    onChange(newSettings)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configurar ruleta {gameName}</h3>
        <p className="text-sm text-gray-400">
          Configura los tipos de paneles y sus cantidades (pesos/probabilidades)
        </p>
      </div>

      <div className="space-y-4">
        {panels.map((panel, index) => (
          <div
            key={panel.id}
            className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Panel {index + 1}</span>
              {panels.length > 1 && (
                <button
                  onClick={() => handleDeletePanel(panel.id)}
                  className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  aria-label="Eliminar panel"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Etiqueta</label>
                <input
                  type="text"
                  value={panel.label}
                  onChange={(e) => handlePanelChange(panel.id, 'label', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm focus:border-white/20 focus:outline-none"
                  placeholder="Nombre del premio"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={panel.count}
                  onChange={(e) => handlePanelChange(panel.id, 'count', parseInt(e.target.value) || 1)}
                  className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Color (opcional)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={panel.color || '#DC2626'}
                  onChange={(e) => handlePanelChange(panel.id, 'color', e.target.value)}
                  className="w-12 h-9 rounded-lg border border-white/10 cursor-pointer"
                />
                <input
                  type="text"
                  value={panel.color || '#DC2626'}
                  onChange={(e) => handlePanelChange(panel.id, 'color', e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm font-mono focus:border-white/20 focus:outline-none"
                  placeholder="#DC2626"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddPanel}
        className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Añadir tipo de panel
      </button>

      <button
        onClick={handleSave}
        className="w-full p-3 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors font-medium"
      >
        Guardar configuración
      </button>
    </div>
  )
}

