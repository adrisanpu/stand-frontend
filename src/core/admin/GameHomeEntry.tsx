import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getOperatorGame, type OperatorGame } from '../../api/operatorGames'
import AppShell from '../shell/AppShell'
import { ThemeProvider } from '../theme'
import GameConfigurationDialog from './GameConfigurationDialog'
import { getGameById } from '../../games'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import HomeAdminButton from '../home/HomeAdminButton'

export default function GameHomeEntry() {
  const [params] = useSearchParams()
  const gameId = params.get('gameId') ?? localStorage.getItem('gameId')
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<{ requestedId: string; game: OperatorGame } | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (gameId === null) return
    let cancelled = false
    setErrorId(null)
    setLoaded(null)
    void getOperatorGame(gameId).then(game => {
      if (!cancelled) setLoaded({ requestedId: gameId, game })
    }).catch(() => {
      if (!cancelled) setErrorId(gameId)
    })
    return () => { cancelled = true }
  }, [gameId, version])

  const game = loaded?.requestedId === gameId ? loaded.game : undefined
  const ready = gameId === null || game !== undefined
  return (
    <>
      {game?.setupReview && !game.setupReview.completed
        ? <ThemeProvider game={getGameById(game.gameType) ?? null}>
          <OperatorLanguageProvider>
            <GameConfigurationDialog gameId={game.gameId} requireSetup onClose={() => setVersion(value => value + 1)} />
          </OperatorLanguageProvider>
        </ThemeProvider>
        : ready
        ? <AppShell key={gameId ?? 'legacy'} initialGame={game} onReturnToAdmin={() => navigate('/admin/games')} />
        : <ThemeProvider game={null}>
          <main className="min-h-dvh bg-[var(--color-background)] p-8 text-textMain">
            {errorId === gameId
              ? <div className="space-y-4">
                <p role="alert">No se pudo abrir la partida. Comprueba tu sesión y que la partida siga disponible.</p>
                <button type="button" className="rounded-xl border border-current/20 px-4 py-2" onClick={() => setVersion(version + 1)}>Reintentar</button>
              </div>
              : <p role="status">Cargando partida…</p>}
          </main>
        </ThemeProvider>}
      {!ready && <HomeAdminButton onClick={() => navigate('/admin/games')} label="Administración" />}
    </>
  )
}
