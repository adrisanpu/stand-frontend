import { useOperatorLanguage } from '../shell/operatorLanguage'

export default function useHomeSamples() {
  const { t } = useOperatorLanguage()
  return {
    players: <div className="card h-full flex items-center justify-center p-4">
      <div className="flex flex-wrap items-center justify-center gap-5">
        <strong className="text-6xl text-primary">24</strong><h2>{t('Jugadores', 'Players')}</h2>
      </div>
    </div>,
    ranking: <div className="card h-full space-y-5 p-6">
      <h2>{t('Ranking', 'Leaderboard')}</h2>
      {['Alex', 'Sam', 'Dani'].map((name, index) => <p key={name} className="flex justify-between gap-4">
        <span>{index + 1}. {name}</span><span className="text-primary">{100 - index * 10}</span>
      </p>)}
    </div>,
    raffle: <div className="card h-full flex flex-col gap-3 p-6">
      <h2>{t('Sorteo', 'Raffle')}</h2>
      <p>{t('Ganadores', 'Winners')} (2)</p>
      {['Alex', 'Sam'].map(name => <p key={name} className="rounded-lg border border-white/10 px-3 py-1">☐ {name}</p>)}
    </div>,
    prizes: <div className="card h-full flex items-center gap-4 rounded-2xl border-2 border-primary p-2">
      <div className="h-full aspect-square shrink-0 rounded-xl bg-primary" aria-hidden="true" />
      <div className="min-w-0"><span className="block uppercase text-primary">{t('Premio', 'Prize')}</span>
        <p className="font-bold">{t('Premio de ejemplo', 'Sample prize')}</p></div>
    </div>,
  }
}
