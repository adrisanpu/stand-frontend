import type { OptionalParticipantField, ParticipantFieldsConfig } from '../../api/publicApi'

export const OPTIONAL_REGISTRATION_FIELDS = [
  { key: 'address', es: 'Dirección', en: 'Address', type: 'text', autoComplete: 'street-address', maxLength: 300 },
  { key: 'company', es: 'Empresa', en: 'Company', type: 'text', autoComplete: 'organization', maxLength: 160 },
  { key: 'sex', es: 'Sexo', en: 'Sex', type: 'select', autoComplete: 'sex', maxLength: 6 },
  { key: 'birthDate', es: 'Fecha de nacimiento', en: 'Date of birth', type: 'date', autoComplete: 'bday', maxLength: 10 },
] as const satisfies readonly { key: OptionalParticipantField; es: string; en: string; type: string; autoComplete: string; maxLength: number }[]

export const PARTICIPANT_PROFILE_FIELDS = [
  ...OPTIONAL_REGISTRATION_FIELDS,
  { key: 'jobTitle', es: 'Cargo', en: 'Job title' },
] as const

export function participantProfileValue(key: OptionalParticipantField, value: string | null | undefined, language: 'es' | 'en') {
  if (key === 'sex' && value === 'male') return language === 'en' ? 'Male' : 'Masculino'
  if (key === 'sex' && value === 'female') return language === 'en' ? 'Female' : 'Femenino'
  return value
}

export function resolveParticipantFields(fields?: ParticipantFieldsConfig, _gameType?: string) {
  return {
    email: { required: true },
    phone: { required: true, enabled: true },
    address: { enabled: fields?.address?.enabled === true },
    company: { enabled: fields?.company?.enabled === true },
    sex: { enabled: fields?.sex?.enabled === true },
    jobTitle: { enabled: fields?.jobTitle?.enabled === true },
    birthDate: { enabled: fields?.birthDate?.enabled === true },
  }
}
