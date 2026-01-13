import { useState, useEffect, useRef } from 'react'
import type { ThemeColors, GameDefinition } from './types'
import { useCurrentUser } from '../auth/useCurrentUser'
import { getFeaturesByPlan } from '../auth/featureFlags'

type AppearanceSettingsProps = {
  onClose: () => void
  gameDefinition?: GameDefinition
}

const STORAGE_KEY_COLORS = 'app_custom_color_palette'
const STORAGE_KEY_LOGO = 'app_custom_logo'
const STORAGE_KEY_THEME_MODE = 'app_theme_mode' // 'dark' | 'light'

// Default Stand palette (used when no game is selected)
const DEFAULT_STAND_PALETTE: ThemeColors = {
  primary: '#9CA3AF',
  accent: '#D1D5DB',
  background: '#0B0A12',
  surface: 'rgba(255,255,255,0.04)',
  textMain: '#EAEAF2',
  textSub: '#9AA0A6',
}

// Light mode color adjustments
const LIGHT_MODE_COLORS = {
  background: '#F5F5F7',
  surface: '#FFFFFF', // Solid white for better visibility
  textMain: '#1D1D1F',
  textSub: '#6E6E73',
}

export default function AppearanceSettings({ onClose, gameDefinition }: AppearanceSettingsProps) {
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [useDefaultPalette, setUseDefaultPalette] = useState(true)
  const [customPrimary, setCustomPrimary] = useState('#B026FF')
  const [customAccent, setCustomAccent] = useState('#22D3EE')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load saved settings on mount
  useEffect(() => {
    const savedColors = localStorage.getItem(STORAGE_KEY_COLORS)
    const savedLogo = localStorage.getItem(STORAGE_KEY_LOGO)
    const savedThemeMode = localStorage.getItem(STORAGE_KEY_THEME_MODE)
    
    if (savedColors) {
      try {
        const parsed = JSON.parse(savedColors) as ThemeColors
        // If custom colors exist, we're using custom palette
        setUseDefaultPalette(false)
        setCustomPrimary(parsed.primary)
        setCustomAccent(parsed.accent)
      } catch {
        // Invalid saved data, use default
        setUseDefaultPalette(true)
      }
    } else {
      setUseDefaultPalette(true)
    }

    if (savedThemeMode === 'light') {
      setIsDarkMode(false)
    } else {
      setIsDarkMode(true)
    }

    if (savedLogo) {
      setLogoPreview(savedLogo)
    }
  }, [])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setLogoError('Por favor, selecciona un archivo de imagen')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('El archivo es demasiado grande. Máximo 5MB')
      return
    }

    setLogoError(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setLogoPreview(result)
    }
    reader.onerror = () => {
      setLogoError('Error al leer el archivo')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    localStorage.removeItem(STORAGE_KEY_LOGO)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getDefaultColors = (): ThemeColors => {
    if (gameDefinition?.colors) {
      return gameDefinition.colors
    }
    return DEFAULT_STAND_PALETTE
  }

  const generateCustomColors = (): ThemeColors => {
    const baseColors = isDarkMode 
      ? {
          background: '#0B0A12',
          surface: 'rgba(255,255,255,0.04)',
          textMain: '#EAEAF2',
          textSub: '#9AA0A6',
        }
      : {
          background: LIGHT_MODE_COLORS.background,
          surface: LIGHT_MODE_COLORS.surface,
          textMain: LIGHT_MODE_COLORS.textMain,
          textSub: LIGHT_MODE_COLORS.textSub,
        }
    
    return {
      primary: customPrimary,
      accent: customAccent,
      ...baseColors,
    }
  }

  const handleSave = () => {
    // Save colors (only if advanced customization is available)
    if (features.advancedCustomization) {
      if (useDefaultPalette) {
        // Remove custom colors to use default
        localStorage.removeItem(STORAGE_KEY_COLORS)
      } else {
        // Save custom colors
        const customColors = generateCustomColors()
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(customColors))
      }
    } else {
      // For free plan, always remove custom colors
      localStorage.removeItem(STORAGE_KEY_COLORS)
    }

    // Save theme mode (always available)
    localStorage.setItem(STORAGE_KEY_THEME_MODE, isDarkMode ? 'dark' : 'light')

    // Save logo (only if advanced customization is available)
    if (features.advancedCustomization) {
      if (logoPreview) {
        localStorage.setItem(STORAGE_KEY_LOGO, logoPreview)
      } else {
        localStorage.removeItem(STORAGE_KEY_LOGO)
      }
    } else {
      // For free plan, always remove custom logo
      localStorage.removeItem(STORAGE_KEY_LOGO)
    }

    // Trigger a page reload to apply changes
    window.location.reload()
  }

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY_COLORS)
    localStorage.removeItem(STORAGE_KEY_LOGO)
    localStorage.removeItem(STORAGE_KEY_THEME_MODE)
    setUseDefaultPalette(true)
    setCustomPrimary('#B026FF')
    setCustomAccent('#22D3EE')
    setIsDarkMode(true)
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    window.location.reload()
  }

  const defaultColors = getDefaultColors()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 id="appearance-settings-title" className="text-xl font-semibold">Configurar Aspecto</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme Mode Toggle */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Modo de Fondo</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
              <div className="flex-1">
                <div className="font-medium mb-1">Modo Oscuro</div>
                <div className="text-sm text-gray-400">Fondo oscuro (por defecto)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isDarkMode}
                  onChange={(e) => setIsDarkMode(!e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
              <div className="flex-1 text-right">
                <div className="font-medium mb-1">Modo Claro</div>
                <div className="text-sm text-gray-400">Fondo claro</div>
              </div>
            </div>
          </div>

          {/* Color Palette Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Paleta de Colores</h3>
            
            {/* Palette Mode Selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setUseDefaultPalette(true)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  useDefaultPalette
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-[rgba(255,255,255,0.05)] hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full border border-white/20"
                    style={{ backgroundColor: defaultColors.primary }}
                  />
                  <div
                    className="w-8 h-8 rounded-full border border-white/20"
                    style={{ backgroundColor: defaultColors.accent }}
                  />
                </div>
                <div className="text-sm font-medium text-left">
                  {gameDefinition ? `Por defecto (${gameDefinition.name})` : 'Por defecto (Stand)'}
                </div>
                <div className="text-xs text-gray-400 text-left mt-1">
                  Usa la paleta del juego
                </div>
              </button>

              <button
                onClick={() => {
                  if (!features.advancedCustomization) return
                  setUseDefaultPalette(false)
                }}
                disabled={!features.advancedCustomization}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  !useDefaultPalette
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-[rgba(255,255,255,0.05)] hover:border-white/20'
                } ${!features.advancedCustomization ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!features.advancedCustomization ? 'Disponible en el plan Event 24h' : undefined}
              >
                {!features.advancedCustomization && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                    <span className="text-xs text-gray-400 font-medium">Event 24h</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full border border-white/20"
                    style={{ backgroundColor: customPrimary }}
                  />
                  <div
                    className="w-8 h-8 rounded-full border border-white/20"
                    style={{ backgroundColor: customAccent }}
                  />
                </div>
                <div className="text-sm font-medium text-left">Personalizado</div>
                <div className="text-xs text-gray-400 text-left mt-1">
                  {features.advancedCustomization 
                    ? 'Paleta bicolor personalizada' 
                    : 'Disponible en el plan Event 24h'}
                </div>
              </button>
            </div>

            {/* Custom Color Editor */}
            {!useDefaultPalette && (
              <div className={`p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-4 relative ${
                !features.advancedCustomization ? 'opacity-50' : ''
              }`}>
                {!features.advancedCustomization && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl z-10">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-300 mb-1">Disponible en el plan Event 24h</p>
                    </div>
                  </div>
                )}
                <h4 className="text-sm font-semibold mb-3">Seleccionar Colores</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-300 w-24">Color Primario</label>
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      disabled={!features.advancedCustomization}
                      className="w-16 h-10 rounded border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      disabled={!features.advancedCustomization}
                      className="flex-1 h-10 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="#000000"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-300 w-24">Color Acento</label>
                    <input
                      type="color"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      disabled={!features.advancedCustomization}
                      className="w-16 h-10 rounded border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      disabled={!features.advancedCustomization}
                      className="flex-1 h-10 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logo Section */}
          <div className={`relative ${!features.advancedCustomization ? 'opacity-50' : ''}`}>
            <h3 className="text-lg font-semibold mb-3">Logo Personalizado</h3>
            {!features.advancedCustomization && (
              <div className="absolute top-0 right-0">
                <span className="text-xs text-gray-400 bg-black/30 px-2 py-1 rounded">Event 24h</span>
              </div>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo personalizado"
                      className="h-24 w-auto object-contain rounded-lg border border-white/10"
                    />
                    {features.advancedCustomization && (
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                        aria-label="Eliminar logo"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={!features.advancedCustomization}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor={features.advancedCustomization ? "logo-upload" : undefined}
                    className={`inline-block px-4 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 transition-colors ${
                      features.advancedCustomization 
                        ? 'hover:bg-[rgba(255,255,255,0.1)] cursor-pointer' 
                        : 'cursor-not-allowed opacity-50'
                    }`}
                    onClick={(e) => {
                      if (!features.advancedCustomization) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                    </div>
                  </label>
                  <p className="text-xs text-gray-400 mt-2">
                    {features.advancedCustomization 
                      ? 'Se mostrará en la pantalla inicial y junto al logo de cada juego. Máximo 5MB.'
                      : 'Disponible en el plan Event 24h'}
                  </p>
                </div>
              </div>
              {logoError && features.advancedCustomization && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                  {logoError}
                </div>
              )}
            </div>
            {!features.advancedCustomization && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl pointer-events-none">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-300">Disponible en el plan Event 24h</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={handleReset}
              className="flex-1 p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors font-medium"
            >
              Restaurar por Defecto
            </button>
            <button
              onClick={handleSave}
              className="flex-1 p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors font-medium"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
