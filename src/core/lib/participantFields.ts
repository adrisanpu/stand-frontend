import type { ParticipantFieldsConfig } from '../../api/publicApi'

export function resolveParticipantFields(fields?: ParticipantFieldsConfig) {
  return {
    email: { required: true },
    phone: { required: false, enabled: fields?.phone?.enabled ?? fields?.phone?.required === true },
  }
}
