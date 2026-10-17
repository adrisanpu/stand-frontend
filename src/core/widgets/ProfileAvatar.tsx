import { useState } from 'react'

function avatarInitial(username: string | undefined): string {
  const raw = (username || 'A').replace(/^@/, '').trim()
  return (raw[0] || 'A').toUpperCase()
}

type Props = {
  profilePicUrl?: string | null
  username?: string
  /** compact = ranking sidebar size; default = phone/display size */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-12 w-12 text-base',
}

/** Circular IG profile pic or initials fallback (shared by ranking / play / display). */
export default function ProfileAvatar({ profilePicUrl, username, size = 'md', className = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const sizeClass = SIZE[size]
  const pic = typeof profilePicUrl === 'string' ? profilePicUrl.trim() : ''
  if (pic && pic !== failedUrl) {
    return (
      <img
        src={pic}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(pic)}
        className={`${sizeClass} shrink-0 rounded-full border border-white/20 object-cover ${className}`}
      />
    )
  }
  return (
    <span
      className={`${sizeClass} shrink-0 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center ${className}`}
      aria-hidden
    >
      {avatarInitial(username)}
    </span>
  )
}
