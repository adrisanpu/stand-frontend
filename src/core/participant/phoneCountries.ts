export const PHONE_COUNTRIES = [
  { code: 'AL', prefix: '+355' }, { code: 'DE', prefix: '+49' },
  { code: 'AD', prefix: '+376' }, { code: 'AM', prefix: '+374' },
  { code: 'AT', prefix: '+43' }, { code: 'AZ', prefix: '+994' },
  { code: 'BE', prefix: '+32' }, { code: 'BY', prefix: '+375' },
  { code: 'BA', prefix: '+387' }, { code: 'BG', prefix: '+359' },
  { code: 'CY', prefix: '+357' }, { code: 'HR', prefix: '+385' },
  { code: 'DK', prefix: '+45' }, { code: 'SK', prefix: '+421' },
  { code: 'SI', prefix: '+386' }, { code: 'ES', prefix: '+34' },
  { code: 'EE', prefix: '+372' }, { code: 'FO', prefix: '+298' },
  { code: 'FI', prefix: '+358' }, { code: 'FR', prefix: '+33' },
  { code: 'GE', prefix: '+995' }, { code: 'GI', prefix: '+350' },
  { code: 'GR', prefix: '+30' }, { code: 'GG', prefix: '+44' },
  { code: 'HU', prefix: '+36' }, { code: 'IE', prefix: '+353' },
  { code: 'IM', prefix: '+44' }, { code: 'IS', prefix: '+354' },
  { code: 'IT', prefix: '+39' }, { code: 'JE', prefix: '+44' },
  { code: 'KZ', prefix: '+7' }, { code: 'XK', prefix: '+383' },
  { code: 'LV', prefix: '+371' }, { code: 'LI', prefix: '+423' },
  { code: 'LT', prefix: '+370' }, { code: 'LU', prefix: '+352' },
  { code: 'MK', prefix: '+389' }, { code: 'MT', prefix: '+356' },
  { code: 'MD', prefix: '+373' }, { code: 'MC', prefix: '+377' },
  { code: 'ME', prefix: '+382' }, { code: 'NO', prefix: '+47' },
  { code: 'NL', prefix: '+31' }, { code: 'PL', prefix: '+48' },
  { code: 'PT', prefix: '+351' }, { code: 'GB', prefix: '+44' },
  { code: 'CZ', prefix: '+420' }, { code: 'RO', prefix: '+40' },
  { code: 'RU', prefix: '+7' }, { code: 'SM', prefix: '+378' },
  { code: 'RS', prefix: '+381' }, { code: 'SE', prefix: '+46' },
  { code: 'CH', prefix: '+41' }, { code: 'TR', prefix: '+90' },
  { code: 'UA', prefix: '+380' }, { code: 'VA', prefix: '+39' },
] as const

export type PhoneCountryCode = typeof PHONE_COUNTRIES[number]['code']

export function internationalPhone(country: PhoneCountryCode, number: string): string {
  const trimmed = number.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`
  return `${PHONE_COUNTRIES.find((item) => item.code === country)!.prefix} ${trimmed}`
}

export function splitInternationalPhone(number: string, country: PhoneCountryCode) {
  const trimmed = number.trim()
  const international = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed
  const selected = PHONE_COUNTRIES.find((item) => item.code === country)!
  const preferred = PHONE_COUNTRIES.filter((item) => item.code === 'GB' || item.code === 'RU')
  const match = [selected, ...preferred, ...PHONE_COUNTRIES]
    .filter((item) => international.startsWith(item.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  return match
    ? { country: match.code, number: international.slice(match.prefix.length).trim() }
    : { country, number }
}
