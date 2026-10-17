import { publicApi, type PlayerResponse } from '../../api/publicApi'

type CapturedAccess = {
  exchange: () => Promise<PlayerResponse>
}

const pendingAccess = new Map<string, CapturedAccess>()

/** Capture before effects run; StrictMode must reuse the same single-use exchange. */
export function captureParticipantAccess(gameId: string): CapturedAccess | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  if (!fragment.has('access')) return pendingAccess.get(gameId) ?? null
  let accessToken = fragment.get('access') ?? ''
  fragment.delete('access')
  const hash = fragment.toString()
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`,
  )
  let request: Promise<PlayerResponse> | undefined
  const access: CapturedAccess = {
    exchange: () => {
      if (!request) {
        request = accessToken
          ? publicApi.exchangeAccess({ gameId, accessToken })
          : Promise.reject(new Error('El enlace de acceso no es válido.'))
        accessToken = ''
      }
      return request
    },
  }
  pendingAccess.set(gameId, access)
  return access
}

export function completeParticipantAccess(gameId: string) {
  pendingAccess.delete(gameId)
}
