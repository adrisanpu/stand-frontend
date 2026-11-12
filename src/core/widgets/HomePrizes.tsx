import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import { usePolling } from '../../hooks/usePolling'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { GamePrize, PrizeSlot } from '../prizes'
import { PrizeImage } from './PrizePresentation'

export type HomePrize = GamePrize & { id: string; heading: string; slot?: PrizeSlot }

type CountersResponse = { ok: boolean; validatedCount?: number; raffleWinners?: unknown[] }
type ScoreResponse = { ok: boolean; results?: unknown[] }

interface HomePrizesProps {
  prizes: HomePrize[]
  gameId: string
  gameName: string
  refreshInterval?: number
}

export default function HomePrizes({ prizes, gameId, gameName, refreshInterval = 10000 }: HomePrizesProps) {
  const { t } = useOperatorLanguage()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [counts, setCounts] = useState<Partial<Record<PrizeSlot, number>>>({})
  const key = prizes.map(prize => prize.id).join('|')
  const count = prizes.length
  const rankingLimit = prizes.find(prize => prize.slot === 'ranking' && prize.limit != null)?.limit ?? null
  const needsCounters = prizes.some(prize => prize.slot && prize.limit != null)

  useEffect(() => setIndex(0), [key])
  useEffect(() => {
    if (count < 2 || paused) return
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setInterval> | undefined
    const update = () => {
      if (timer) clearInterval(timer)
      if (!media?.matches) timer = setInterval(() => setIndex(previous => (previous + 1) % count), 4000)
    }
    update()
    media?.addEventListener?.('change', update)
    return () => { if (timer) clearInterval(timer); media?.removeEventListener?.('change', update) }
  }, [count, paused])

  usePolling(async () => {
    if (!needsCounters || !gameName) return
    const data = await api.get<CountersResponse>(`/v1/game?gameName=${encodeURIComponent(gameName)}`)
    if (!data.ok) throw new Error('API response not ok')
    const next: Partial<Record<PrizeSlot, number>> = {
      validation: data.validatedCount ?? 0,
      raffle: Array.isArray(data.raffleWinners) ? data.raffleWinners.length : 0,
    }
    if (rankingLimit != null) {
      const score = await api.get<ScoreResponse>(`/v1/game/score?gameId=${encodeURIComponent(gameId)}&limit=${rankingLimit}`)
      next.ranking = Array.isArray(score.results) ? Math.min(score.results.length, rankingLimit) : 0
    }
    setCounts(next)
  }, [gameId, gameName, needsCounters, rankingLimit], { interval: needsCounters ? refreshInterval : 0 })

  if (!count) {
    return <div className="card h-full w-full flex items-center justify-center p-3 text-center">
      <p className="text-textSub">{t('Sin premios configurados', 'No prizes configured')}</p>
    </div>
  }
  const prize = prizes[index % count]
  const current = prize.slot ? counts[prize.slot] : undefined
  const sliding = count > 1
  return <div data-testid="home-prizes" className="card h-full w-full min-w-0 flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-primary p-2"
    aria-roledescription={t('carrusel', 'carousel')} aria-label={t('Premios', 'Prizes')}>
    <div key={`${prize.id}-image`} className={`h-full aspect-square shrink-0 overflow-hidden rounded-xl bg-primary flex items-center justify-center p-1 ${sliding ? 'prize-catalog-slide' : ''}`}>
      {prize.imageUrl
        ? <PrizeImage prize={prize} className="h-full w-full object-contain" />
        : <svg aria-hidden="true" className="h-1/2 w-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112-2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>}
    </div>
    <div key={prize.id} className={`min-w-0 flex-1 flex flex-col justify-center gap-1 ${sliding ? 'prize-catalog-slide' : ''}`} aria-live="polite">
      {prize.heading && <span className="block truncate font-semibold uppercase tracking-wider text-primary">{prize.heading}</span>}
      <p title={prize.name} className="font-bold leading-tight text-textMain line-clamp-2 [overflow-wrap:anywhere]">{prize.name}</p>
      {sliding && <div aria-hidden="true" className="flex gap-1">
        {prizes.map((entry, position) => <span key={entry.id}
          className={`h-1.5 rounded-full transition-all ${position === index % count ? 'w-4 bg-primary' : 'w-1.5 bg-white/30'}`} />)}
      </div>}
    </div>
    {prize.limit != null && current !== undefined && <p className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-semibold text-textMain tabular-nums">
      {current}/{prize.limit}
    </p>}
    {sliding && <div className="sr-only focus-within:not-sr-only shrink-0 flex">
      <button type="button" className="rounded-full p-1 text-xs hover:bg-primary/20" aria-pressed={paused}
        onClick={() => setPaused(previous => !previous)}>{paused ? t('Reanudar premios', 'Resume prizes') : t('Pausar premios', 'Pause prizes')}</button>
      <button type="button" className="rounded-full p-1 text-xs hover:bg-primary/20"
        onClick={() => setIndex(previous => (previous + 1) % count)}>{t('Siguiente premio', 'Next prize')}</button>
    </div>}
  </div>
}
