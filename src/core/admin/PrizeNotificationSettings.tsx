import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import { useOperatorLanguage } from '../shell/operatorLanguage'

export type PrizeNotification = { play: boolean; email: boolean }

export const DEFAULT_PRIZE_NOTIFICATION: PrizeNotification = { play: true, email: false }

/** Per-game choice of how winners receive their prize QR: on /play and/or by email. */
export default function PrizeNotificationSettings({ gameId, readOnly = false }: { gameId: string; readOnly?: boolean }) {
  const { t } = useOperatorLanguage()
  const [value, setValue] = useState<{ gameId: string; channels: PrizeNotification } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setValue(null)
    setError(null)
    void api.get<{ ok: boolean; game?: { prizeNotification?: PrizeNotification } }>(
      `/v1/game?gameId=${encodeURIComponent(gameId)}&configuration=true`,
    ).then((response) => {
      if (cancelled) return
      if (!response.ok || !response.game) throw new Error('Invalid game response')
      setValue({ gameId, channels: { ...DEFAULT_PRIZE_NOTIFICATION, ...response.game.prizeNotification } })
    }).catch(() => {
      if (!cancelled) setError(t('No se pudo cargar cómo se notifican los premios.', 'Could not load prize notification settings.'))
    })
    return () => { cancelled = true }
  }, [gameId, t])

  const current = value?.gameId === gameId ? value.channels : null
  const toggle = async (channel: keyof PrizeNotification, checked: boolean) => {
    if (!current || saving) return
    const next = { ...current, [channel]: checked }
    if (!next.play && !next.email) return
    setSaving(true)
    setError(null)
    try {
      const response = await api.put<{ ok?: boolean }>('/v1/game', { gameId, prizeNotification: next })
      if (response.ok === false) throw new Error('Prize notification save failed')
      setValue({ gameId, channels: next })
    } catch {
      setError(t('No se pudo guardar cómo se notifican los premios.', 'Could not save prize notification settings.'))
    } finally {
      setSaving(false)
    }
  }

  const options: [keyof PrizeNotification, string][] = [
    ['play', t('En la pantalla del juego (/play), debajo del juego', 'On the game screen (/play), below the game')],
    ['email', t('Por email', 'By email')],
  ]
  return <fieldset className="space-y-2 rounded-xl border border-current/15 p-3" aria-busy={saving}>
    <legend className="px-1 font-semibold">{t('Cómo recibe el jugador su premio / QR', 'How players receive their prize / QR')}</legend>
    {!current && !error && <p role="status" className="text-sm">{t('Cargando…', 'Loading…')}</p>}
    {current && options.map(([channel, label]) => {
      const lastChecked = current[channel] && !(channel === 'play' ? current.email : current.play)
      return <label key={channel} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={current[channel]} disabled={readOnly || saving || lastChecked}
          onChange={(event) => void toggle(channel, event.target.checked)} />
        {label}
      </label>
    })}
    {current && <p className="text-xs opacity-70">{t('Debe haber al menos una opción marcada.', 'At least one option must be selected.')}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </fieldset>
}
