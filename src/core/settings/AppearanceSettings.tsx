import { useState, useEffect, useRef } from 'react'
import type { ThemeColors, GameDefinition } from '../types'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { OperatorLanguageSelector, useOperatorLanguage } from '../shell/operatorLanguage'
import { STORAGE_KEY_COLORS, STORAGE_KEY_THEME_MODE } from '../storageKeys'
import {
  deleteUserMedia,
  fetchUserMedia,
  selectLogo,
  uploadLogo,
  resolveLogoDisplayUrl,
  saveAppearance,
  type UserMediaItem,
  type UserMediaResponse,
} from '../../api/userMedia'

type AppearanceSettingsProps = {
  /** Vuelve a la lista del menú Configuración */
  onBack: () => void
  /** Cierra por completo el menú de ajustes (vista catálogo) */
  onCloseMenu: () => void
  gameDefinition?: GameDefinition
}

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

export default function AppearanceSettings({ onBack, onCloseMenu, gameDefinition }: AppearanceSettingsProps) {
  const { t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [useDefaultPalette, setUseDefaultPalette] = useState(true)
  const [customPrimary, setCustomPrimary] = useState('#B026FF')
  const [customAccent, setCustomAccent] = useState('#22D3EE')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [userMedia, setUserMedia] = useState<UserMediaResponse | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoPickerOpen, setLogoPickerOpen] = useState(false)
  const [logoHistory, setLogoHistory] = useState<UserMediaItem[]>([])
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoDropdownRef = useRef<HTMLDivElement>(null)
  const paletteCustomBackupRef = useRef<{ primary: string; accent: string } | null>(null)

  // Load saved settings on mount
  useEffect(() => {
    const savedColors = localStorage.getItem(STORAGE_KEY_COLORS)
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

    const loadMedia = async () => {
      try {
        const media = await fetchUserMedia()
        if (media.appearance) {
          setUseDefaultPalette(!media.appearance.colors)
          if (media.appearance.colors) {
            setCustomPrimary(media.appearance.colors.primary)
            setCustomAccent(media.appearance.colors.accent)
          }
          setIsDarkMode(media.appearance.themeMode !== 'light')
        }
        setUserMedia(media)
        setLogoHistory(media.logo.items)
        setSelectedLogoId(media.logo.selectedId)
      } catch {
        // Fallback to local-only mode when API is not available.
      }
    }
    void loadMedia()
  }, [])

  // Logo preview: user selection, or default white/black letters from API by aspecto (oscuro/claro).
  useEffect(() => {
    if (!userMedia) return
    if (userMedia.logo.selectedId) {
      const url =
        userMedia.logo.selected?.url ??
        userMedia.logo.items.find((it) => it.id === userMedia.logo.selectedId)?.url
      if (url) setLogoPreview(url)
      return
    }
    setLogoPreview(resolveLogoDisplayUrl(userMedia, isDarkMode))
  }, [isDarkMode, userMedia])

  useEffect(() => {
    if (!logoPickerOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = logoDropdownRef.current
      if (el && !el.contains(e.target as Node)) {
        setLogoPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [logoPickerOpen])

  const refreshMedia = async () => {
    const media = await fetchUserMedia()
    setUserMedia(media)
    setLogoHistory(media.logo.items)
    setSelectedLogoId(media.logo.selectedId)
    window.dispatchEvent(new Event('user-media-updated'))
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    try {
      await uploadLogo(file)
      await refreshMedia()
    } catch {
      setLogoError('Error al subir el logo')
    }
  }

  const handleRemoveLogo = async () => {
    if (!selectedLogoId) {
      if (userMedia) setLogoPreview(resolveLogoDisplayUrl(userMedia, isDarkMode))
      return
    }
    await deleteUserMedia('logo', selectedLogoId)
    setSelectedLogoId(null)
    await refreshMedia()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSelectStoredLogo = async (item: UserMediaItem) => {
    await selectLogo(item.id)
    setSelectedLogoId(item.id)
    setLogoPreview(item.url ?? null)
    setLogoError(null)
    await refreshMedia()
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

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAppearance({
        colors: features.advancedCustomization && !useDefaultPalette
          ? { primary: customPrimary, accent: customAccent } : null,
        themeMode: isDarkMode ? 'dark' : 'light',
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el aspecto.')
      setSaving(false)
      return
    }
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

    // Trigger a page reload to apply changes
    window.location.reload()
  }

  const handleReset = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAppearance({ colors: null, themeMode: 'dark' })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo restaurar el aspecto.')
      setSaving(false)
      return
    }
    localStorage.removeItem(STORAGE_KEY_COLORS)
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
  const previewPrimary = useDefaultPalette ? defaultColors.primary : customPrimary
  const previewAccent = useDefaultPalette ? defaultColors.accent : customAccent

  const translateKnownError = (message: string) => {
    const translations: Record<string, string> = {
    'Por favor, selecciona un archivo de imagen': t('Por favor, selecciona un archivo de imagen', 'Please select an image file'),
    'El archivo es demasiado grande. Máximo 5MB': t('El archivo es demasiado grande. Máximo 5MB', 'The file is too large. Maximum 5 MB'),
    'Error al subir el logo': t('Error al subir el logo', 'Error uploading the logo'),
    'No se pudo guardar el aspecto.': t('No se pudo guardar el aspecto.', 'Could not save the appearance settings.'),
    'No se pudo restaurar el aspecto.': t('No se pudo restaurar el aspecto.', 'Could not restore the appearance settings.'),
    }
    return Object.prototype.hasOwnProperty.call(translations, message) ? translations[message] : message
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onBack} aria-hidden="true" />
      <div className="relative card w-full max-w-4xl p-5 sm:p-6 max-h-[90vh] flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label={t('Volver', 'Back')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="appearance-settings-title" className="text-xl font-semibold truncate">
              {t('Configurar aspecto', 'Appearance settings')}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
          <OperatorLanguageSelector />
          <button
            type="button"
            onClick={onCloseMenu}
            className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
            aria-label={t('Cerrar configuración', 'Close settings')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          disabled={!features.advancedCustomization}
          className="hidden"
          id="logo-upload"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 lg:min-h-[26rem] lg:items-stretch">
          {/* Columna 1: logo */}
          <div className="flex flex-col min-h-0 min-w-0 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-4 h-full lg:min-h-0">
            <div
              className={`flex flex-col flex-1 min-h-0 ${
                !features.advancedCustomization ? 'opacity-50' : ''
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-300 mb-3 shrink-0">{t('Logo personalizado', 'Custom logo')}</h3>
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 items-start">
                <div className="flex justify-center">
                  {logoPreview ? (
                    <div className="relative inline-block max-w-full">
                      <img
                        src={logoPreview}
                        alt={t('Logo actual', 'Current logo')}
                        className="h-[5.5rem] max-w-full w-auto object-contain rounded-lg border border-white/10"
                      />
                      {features.advancedCustomization && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                          aria-label={t('Quitar logo', 'Remove logo')}
                        >
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-[5.5rem] w-[5.5rem] rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center shrink-0">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0" ref={logoDropdownRef}>
                  <label
                    htmlFor={features.advancedCustomization ? 'logo-upload' : undefined}
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 transition-colors text-sm w-full ${
                      features.advancedCustomization
                        ? 'hover:bg-primary/20 cursor-pointer'
                        : 'cursor-not-allowed pointer-events-none'
                    }`}
                    onClick={(e) => {
                      if (!features.advancedCustomization) e.preventDefault()
                    }}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t('Cambiar', 'Change')}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!features.advancedCustomization || logoHistory.length === 0}
                      onClick={() => features.advancedCustomization && setLogoPickerOpen((o) => !o)}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 transition-colors text-sm w-full ${
                        features.advancedCustomization && logoHistory.length > 0
                          ? 'hover:bg-primary/20'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      aria-expanded={logoPickerOpen}
                      aria-haspopup="listbox"
                    >
                      {t('Historial', 'History')}
                      <svg
                        className={`w-4 h-4 shrink-0 transition-transform ${logoPickerOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {logoPickerOpen && features.advancedCustomization && logoHistory.length > 0 && (
                      <div
                        className="absolute z-50 bottom-full mb-2 left-0 right-0 w-full min-w-[12rem] rounded-xl border border-white/10 bg-[#14141f] shadow-xl p-3 max-h-[min(240px,50vh)] overflow-y-auto"
                        role="listbox"
                      >
                        <p className="text-xs text-gray-500 mb-2 px-1">{t('Logos almacenados', 'Saved logos')}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {logoHistory.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              role="option"
                              aria-selected={selectedLogoId === preset.id}
                              onClick={async () => {
                                await handleSelectStoredLogo(preset)
                                setLogoPickerOpen(false)
                              }}
                              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                                selectedLogoId === preset.id
                                  ? 'border-primary bg-primary/10'
                                  : 'border-primary/30 bg-[rgba(255,255,255,0.04)] hover:border-white/25'
                              }`}
                            >
                              <img src={preset.url ?? ''} alt="" className="h-10 w-10 object-contain rounded" />
                              <span className="text-[10px] font-medium text-gray-300 text-center leading-tight line-clamp-2">
                                {preset.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 shrink-0">
                    {features.advancedCustomization ? t('Máx. 5MB.', 'Max. 5 MB.') : t('Disponible en el plan Event 24h', 'Available on the Event 24h plan')}
                  </p>
                </div>
              </div>
              {logoError && features.advancedCustomization && (
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs mt-2 shrink-0">
                  {translateKnownError(logoError)}
                </div>
              )}
            </div>
          </div>

          {/* Columna 2: modo de fondo + paleta */}
          <div className="rounded-xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-4 flex flex-col min-h-0 min-w-0 h-full lg:min-h-0 overflow-y-auto">
            <div className="shrink-0 pb-4 border-b border-white/10 mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('Modo de fondo', 'Background mode')}</h3>
              <div className="flex items-center justify-center gap-3">
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
                    isDarkMode ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 text-gray-500'
                  }`}
                  aria-hidden
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </span>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!isDarkMode}
                    onChange={(e) => setIsDarkMode(!e.target.checked)}
                    aria-label={t('Modo claro', 'Light mode')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
                    !isDarkMode ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 text-gray-500'
                  }`}
                  aria-hidden
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <div
              className={`flex flex-col flex-1 min-h-0 min-w-0 ${
                !features.advancedCustomization ? 'opacity-50' : ''
              }`}
            >
            <h3 className="text-sm font-semibold text-gray-300 mb-3 shrink-0">{t('Paleta de colores', 'Color palette')}</h3>
            <div
              className="mx-auto w-[4.5rem] h-[4.5rem] rounded-xl border-2 border-white/20 overflow-hidden shrink-0 mb-2"
              style={{
                background: `linear-gradient(135deg, ${previewPrimary} 0%, ${previewPrimary} 50%, ${previewAccent} 50%, ${previewAccent} 100%)`,
              }}
              aria-hidden
            />
            <p className="text-center text-xs text-gray-400 mb-4 shrink-0">
              {useDefaultPalette
                ? gameDefinition
                  ? t('Por defecto', 'Default') + ` (${gameDefinition.name})`
                  : t('Por defecto (Stand)', 'Default (Stand)')
                : t('Personalizado', 'Custom')}
            </p>

            <div className="space-y-3 shrink-0">
              <label
                className={`flex items-center justify-between gap-3 ${features.advancedCustomization ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                htmlFor="appearance-palette-default"
              >
                <span className="text-sm text-gray-300">{t('Usar paleta por defecto', 'Use default palette')}</span>
                <span className="relative inline-flex shrink-0">
                  <input
                    id="appearance-palette-default"
                    type="checkbox"
                    checked={useDefaultPalette}
                    disabled={!features.advancedCustomization}
                    onChange={(e) => {
                      if (!features.advancedCustomization) return
                      const next = e.target.checked
                      if (next) {
                        paletteCustomBackupRef.current = { primary: customPrimary, accent: customAccent }
                      } else {
                        const b = paletteCustomBackupRef.current
                        if (b) {
                          setCustomPrimary(b.primary)
                          setCustomAccent(b.accent)
                          paletteCustomBackupRef.current = null
                        } else {
                          setCustomPrimary(defaultColors.primary)
                          setCustomAccent(defaultColors.accent)
                        }
                      }
                      setUseDefaultPalette(next)
                    }}
                    className="sr-only peer"
                  />
                  <span
                    className="w-11 h-6 bg-gray-600 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 peer-checked:bg-primary peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white relative block"
                    aria-hidden
                  />
                </span>
              </label>
              <p className="text-xs text-gray-500">{t('Desactiva para elegir primario y acento.', 'Turn off to choose primary and accent colors.')}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 space-y-3 flex-1 min-h-0">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300 w-20 shrink-0">{t('Primario', 'Primary')}</label>
                <input
                  type="color"
                  value={useDefaultPalette ? defaultColors.primary : customPrimary}
                  onChange={(e) => {
                    if (!features.advancedCustomization || useDefaultPalette) return
                    setCustomPrimary(e.target.value)
                  }}
                  disabled={!features.advancedCustomization || useDefaultPalette}
                  className="w-14 h-10 rounded border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                />
                <input
                  type="text"
                  value={useDefaultPalette ? defaultColors.primary : customPrimary}
                  onChange={(e) => {
                    if (!features.advancedCustomization || useDefaultPalette) return
                    setCustomPrimary(e.target.value)
                  }}
                  disabled={!features.advancedCustomization || useDefaultPalette}
                  className="flex-1 min-w-0 h-10 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="#000000"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300 w-20 shrink-0">{t('Acento', 'Accent')}</label>
                <input
                  type="color"
                  value={useDefaultPalette ? defaultColors.accent : customAccent}
                  onChange={(e) => {
                    if (!features.advancedCustomization || useDefaultPalette) return
                    setCustomAccent(e.target.value)
                  }}
                  disabled={!features.advancedCustomization || useDefaultPalette}
                  className="w-14 h-10 rounded border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                />
                <input
                  type="text"
                  value={useDefaultPalette ? defaultColors.accent : customAccent}
                  onChange={(e) => {
                    if (!features.advancedCustomization || useDefaultPalette) return
                    setCustomAccent(e.target.value)
                  }}
                  disabled={!features.advancedCustomization || useDefaultPalette}
                  className="flex-1 min-w-0 h-10 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="#000000"
                />
              </div>
              {!features.advancedCustomization && (
                <p className="text-xs text-gray-500 pt-1">{t('Personalización de color en el plan Event 24h.', 'Color customization is available on the Event 24h plan.')}</p>
              )}
            </div>
            </div>
          </div>
        </div>

        {saveError && <p role="alert" className="text-sm text-red-300">{translateKnownError(saveError)}</p>}
        <div className="flex gap-3 pt-4 mt-auto border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="flex-1 p-3 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors font-medium"
          >
            {t('Restaurar por Defecto', 'Restore defaults')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors font-medium"
          >
            {saving ? t('Guardando...', 'Saving...') : t('Guardar Cambios', 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  )
}
