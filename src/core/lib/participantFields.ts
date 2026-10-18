import type { ParticipantFieldsConfig } from '../../api/publicApi'

export function resolveParticipantFields(fields?: ParticipantFieldsConfig) {
  return {
    email: { required: fields?.email?.required !== false },
    phone: { required: fields?.phone?.required === true },
  }
}
