import type { ParticipantFieldsConfig } from '../../api/publicApi'

export function resolveParticipantFields(fields?: ParticipantFieldsConfig, gameType?: string) {
  const isStack = gameType?.toUpperCase() === 'STACK'
  return {
    email: { required: true },
    phone: { required: isStack, enabled: isStack || (fields?.phone?.enabled ?? fields?.phone?.required === true) },
  }
}
