import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Language = 'es' | 'en'
type Translate = (spanish: string, english?: string) => string
type OperatorLanguage = {
  language: Language
  setLanguage: (language: Language) => void
  t: Translate
}

const OperatorLanguageContext = createContext<OperatorLanguage>({
  language: 'es',
  setLanguage: () => {},
  t: (spanish) => spanish,
})

export function OperatorLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('es')
  const t = useCallback<Translate>((spanish, english) => language === 'en' ? english ?? spanish : spanish, [language])

  return (
    <OperatorLanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </OperatorLanguageContext.Provider>
  )
}

export function useOperatorLanguage() {
  return useContext(OperatorLanguageContext)
}

export function OperatorLanguageSelector() {
  const { language, setLanguage, t } = useOperatorLanguage()
  return (
    <select
      aria-label={t('Idioma', 'Language')}
      value={language}
      onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'es')}
      className="rounded-lg border border-white/20 bg-surface px-2 py-1.5 text-sm font-semibold text-textMain"
    >
      <option value="es">ES</option>
      <option value="en">EN</option>
    </select>
  )
}
