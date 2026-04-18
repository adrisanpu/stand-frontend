import { useCallback, useMemo, useState } from 'react'

type AvatarState =
  | 'idle'
  | 'validating'
  | 'ready'
  | 'playing'
  | 'result'
  | 'finished'

type GameStateAvatarProps = {
  state: AvatarState | string
  className?: string
  mediaUrls?: Partial<Record<'idle' | 'win' | 'lose', string | null>>
}

function mapStateToAvatarVariant(state: string): 'idle' | 'win' | 'lose' {
  const normalized = state.trim().toLowerCase() || 'idle'
  const loseStates = new Set(['invalid', 'lose', 'cross_quiz_lose'])
  const winStates = new Set(['valid', 'success', 'win', 'result', 'finished', 'cross_quiz_win'])
  if (loseStates.has(normalized)) return 'lose'
  if (winStates.has(normalized)) return 'win'
  if (normalized.includes('lose')) return 'lose'
  if (normalized.includes('win')) return 'win'
  return 'idle'
}

export default function GameStateAvatar({ state, className, mediaUrls }: GameStateAvatarProps) {
  const variant = useMemo(() => mapStateToAvatarVariant(state), [state])
  const [failed, setFailed] = useState(false)
  const sourceUrl = mediaUrls?.[variant] ?? null
  const handleVideoEnded = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    video.currentTime = 0
    void video.play()
  }, [])

  if (failed) {
    return (
      <div className={className ?? 'w-full h-full'}>
        <div className="w-full h-full flex items-center justify-center rounded-lg bg-black/20">
          <span className="text-xs text-white/70 font-medium">Avatar no disponible</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className ?? 'w-full h-full'}>
      <video
        key={`${variant}-${sourceUrl ?? 'missing'}`}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnded}
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
        aria-label={`Avatar del estado ${state}`}
      >
        {sourceUrl && <source src={sourceUrl} type="video/mp4" />}
      </video>
    </div>
  )
}
