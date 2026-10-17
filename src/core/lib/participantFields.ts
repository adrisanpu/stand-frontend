import type { ParticipantFieldsConfig } from '../../api/publicApi'

export function resolveParticipantFields(fields?: ParticipantFieldsConfig) {
  return {
    email: { required: fields?.email?.required !== false },
    instagram: { required: fields?.instagram?.required === true },
    phone: { required: fields?.phone?.required === true },
  }
}
