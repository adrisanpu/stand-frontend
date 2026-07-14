import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ThemeProvider } from '../theme'
import { getGameById } from '../../games'
import { publicApi, type PublicGameResponse } from '../../api/publicApi'
import { getJoinUrl } from '../lib/joinUrl'
import QRCode from '../widgets/QRCode'
import { getJoinInstructions } from '../ui/gameJoinInstructions'

const POLL_MS = 4000

export default function PublicDisplayShell() {
  const { gameId = '' } = useParams()
  const game = getGameById('EMPAREJA2')
  const [data, setData] = useState<PublicGameResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await publicApi.getGame(gameId)
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      }
    }
    void load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [gameId])

  const joinChannel = data?.joinChannel ?? 'web'
  const qrUrl = getJoinUrl(gameId, joinChannel)
  const colors = game?.colors

  return (
    <ThemeProvider game={game ?? null}>
      <div
        className="min-h-dvh text-textMain font-sans p-4 sm:p-8"
        style={{ background: colors?.background ?? '#0B0A12', color: colors?.textMain ?? '#EAEAF2' }}
      >
        <div className="mx-auto max-w-6xl grid lg:grid-cols-[1fr_1.2fr_1fr] gap-6 items-stretch min-h-[calc(100dvh-2rem)]">
          {/* Left: brand + QR */}
          <div className="card flex flex-col items-center justify-center gap-4 p-6">
            {game?.assets?.logo && (
              <img src={game.assets.logo} alt="EMPAREJA2" className="h-24 w-auto object-contain" />
            )}
            <QRCode
              data={qrUrl}
              size={280}
              containerClassName="w-full max-w-[240px] aspect-square"
              alt="QR para unirse"
              className="!bg-white !p-3"
            />
            <p className="text-sm font-semibold uppercase tracking-wide text-textSub text-center">
              Escanea para jugar
            </p>
            <p className="text-xs text-textSub font-mono">{gameId}</p>
          </div>

          {/* Center: instructions */}
          <div className="card flex flex-col justify-center p-6 sm:p-8 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">
              {data?.gameName || 'EMPAREJA2'}
            </h1>
            <ul className="space-y-2 text-sm sm:text-base text-textSub list-disc pl-5">
              {getJoinInstructions('EMPAREJA2')}
            </ul>
            {error && <p className="text-red-300 text-sm text-center">{error}</p>}
          </div>

          {/* Right: live results */}
          <div className="card flex flex-col p-6 gap-4 min-h-0">
            <h2 className="text-lg font-semibold text-center">En vivo</h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-2xl font-bold">{data?.playerCount ?? '—'}</p>
                <p className="text-xs text-textSub">Jugadores</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-2xl font-bold">{data?.validatedCount ?? '—'}</p>
                <p className="text-xs text-textSub">Validados</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
              <p className="text-xs uppercase tracking-wide text-textSub">Últimas parejas</p>
              {(data?.recentPairs?.length ?? 0) === 0 ? (
                <p className="text-sm text-textSub text-center py-8">Aún no hay parejas validadas</p>
              ) : (
                data!.recentPairs
                  .slice()
                  .reverse()
                  .map((pair, i) => (
                    <div key={`${pair.validatedAt}-${i}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="font-medium">{pair.label}</p>
                      {pair.characterNames?.length > 0 && (
                        <p className="text-xs text-textSub">{pair.characterNames.join(' · ')}</p>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
