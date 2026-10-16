import type { ReactNode } from 'react'
import ProfileAvatar from '../widgets/ProfileAvatar'

type Props = {
  title: string
  displayName: string
  profilePicUrl?: string | null
  rank?: number | null
  notice: string
  children: ReactNode
}

export default function ScoreResultView({ title, displayName, profilePicUrl, rank, notice, children }: Props) {
  return (
    <div className="card p-6 text-center space-y-4">
      <div className="flex flex-col items-center gap-2">
        <ProfileAvatar profilePicUrl={profilePicUrl} username={displayName} size="lg" />
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-textSub truncate max-w-full">{displayName}</p>
      </div>
      {children}
      {rank != null && (
        <p className="text-lg">
          Posición: <span className="font-bold">#{rank}</span>
        </p>
      )}
      <p className="text-sm text-textSub">{notice}</p>
    </div>
  )
}
