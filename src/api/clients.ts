import { api } from './api'

export type ClientSummary = {
  id: string
  name: string | null
  email: string
  phone: string | null
  participationCount: number
}

export type ClientAward = {
  id: string
  imageUrl?: string | null
  name: string | null
  source: string | null
  condition: string | null
  awardedAt: string | null
  awardState: string | null
  kivlyAssignmentState: string | null
  emailState: string | null
  deliveryChannel: string | null
  collected: boolean
  collectedAt: string | null
}

export type ClientParticipation = {
  gameId: string
  gameName: string | null
  gameType: string | null
  joinedAt: string | null
  name: string | null
  phone: string | null
  awards: ClientAward[]
}

export type ClientHistory = {
  client: ClientSummary
  participations: ClientParticipation[]
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isClientSummary(value: unknown): value is ClientSummary {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string' && /^[0-9a-f]{64}$/.test(value.id)
    && 'name' in value && isTextOrNull(value.name)
    && 'email' in value && typeof value.email === 'string' && !!value.email
    && 'phone' in value && isTextOrNull(value.phone)
    && 'participationCount' in value && typeof value.participationCount === 'number'
    && Number.isSafeInteger(value.participationCount) && value.participationCount >= 1
}

function isClientAward(value: unknown): value is ClientAward {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && (!('imageUrl' in value) || isTextOrNull(value.imageUrl))
    && 'name' in value && isTextOrNull(value.name)
    && 'source' in value && isTextOrNull(value.source)
    && 'condition' in value && isTextOrNull(value.condition)
    && 'awardedAt' in value && isTextOrNull(value.awardedAt)
    && 'awardState' in value && isTextOrNull(value.awardState)
    && 'kivlyAssignmentState' in value && isTextOrNull(value.kivlyAssignmentState)
    && 'emailState' in value && isTextOrNull(value.emailState)
    && 'deliveryChannel' in value && isTextOrNull(value.deliveryChannel)
    && 'collected' in value && typeof value.collected === 'boolean'
    && 'collectedAt' in value && isTextOrNull(value.collectedAt)
}

function isClientParticipation(value: unknown): value is ClientParticipation {
  return typeof value === 'object' && value !== null
    && 'gameId' in value && typeof value.gameId === 'string'
    && 'gameName' in value && isTextOrNull(value.gameName)
    && 'gameType' in value && isTextOrNull(value.gameType)
    && 'joinedAt' in value && isTextOrNull(value.joinedAt)
    && 'name' in value && isTextOrNull(value.name)
    && 'phone' in value && isTextOrNull(value.phone)
    && 'awards' in value && Array.isArray(value.awards) && value.awards.every(isClientAward)
}

export async function listClients(cursor?: string): Promise<{ clients: ClientSummary[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: '25' })
  if (cursor) query.set('cursor', cursor)
  const data = await api.get<{ ok: boolean; clients: unknown; nextCursor: unknown }>(
    `/v1/clients?${query.toString()}`,
  )
  if (data?.ok !== true || !Array.isArray(data.clients) || !data.clients.every(isClientSummary)
    || !(data.nextCursor === null || typeof data.nextCursor === 'string')
    || new Set(data.clients.map(client => client.id)).size !== data.clients.length) {
    throw new Error('Invalid clients response')
  }
  return { clients: data.clients, nextCursor: data.nextCursor }
}

export async function searchClients(page: number, search: string): Promise<{
  clients: ClientSummary[]; page: number; total: number
}> {
  const query = new URLSearchParams({ page: String(page), search })
  const data = await api.get<{
    ok: boolean; clients: unknown; page: number; total: number; pageSize: number
  }>(`/v1/clients?${query.toString()}`)
  if (data?.ok !== true || !Array.isArray(data.clients) || !data.clients.every(isClientSummary)
    || data.pageSize !== 25 || data.clients.length > 25
    || !Number.isSafeInteger(data.page) || data.page < 1
    || !Number.isSafeInteger(data.total) || data.total < 0
    || new Set(data.clients.map(client => client.id)).size !== data.clients.length
    || data.page > Math.max(1, Math.ceil(data.total / 25))
    || data.clients.length !== Math.min(25, Math.max(0, data.total - (data.page - 1) * 25))) {
    throw new Error('Invalid clients response')
  }
  return { clients: data.clients, page: data.page, total: data.total }
}

export async function getClientHistory(clientId: string): Promise<ClientHistory> {
  if (!/^[0-9a-f]{64}$/.test(clientId)) throw new Error('Invalid client id')
  const data = await api.get<{ ok: boolean; client: unknown; participations: unknown }>(
    `/v1/clients/${encodeURIComponent(clientId)}`,
  )
  if (data?.ok !== true || !isClientSummary(data.client)
    || data.client.id !== clientId || !Array.isArray(data.participations)
    || !data.participations.every(isClientParticipation)) {
    throw new Error('Invalid client history response')
  }
  return { client: data.client, participations: data.participations }
}
