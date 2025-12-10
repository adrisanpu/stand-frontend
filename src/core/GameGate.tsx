import { useState } from 'react'
import { games } from '../games'
import type { GameDefinition } from './types'

const GAME_RE = /^[A-Za-z0-9._-]{1,40}$/
const API_BASE = "https://3u0n7y51m9.execute-api.us-east-1.amazonaws.com/prod"

type GameGateProps = {
  onGameCreated: (gameName: string, gameId: string, gameType?: string) => void
  onSetGameId: (gameId: string) => void
}

export default function GameGate({ onGameCreated, onSetGameId }: GameGateProps){
  const [selectedGame, setSelectedGame] = useState<GameDefinition | null>(null)
  const [gameId, setGameId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)

  const validateGameId = (id: string) => GAME_RE.test(id)

  const handleGameSelect = (game: GameDefinition) => {
    setSelectedGame(game)
    setGameId('')
    setError(null)
  }

  const handleBackToCatalog = () => {
    setSelectedGame(null)
    setGameId('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!selectedGame) return
    
    setError(null)
    if (!validateGameId(gameId)) {
      setError('Nombre de partida inválido. Usa letras, números, _ - .')
      return
    }
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameName: gameId.toUpperCase(),
          gameType: selectedGame.id
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al crear partida')
      // API returns { message, gameName, gameId, table, gameType, createdAt }
      if (data.gameName && data.gameId) {
        onGameCreated(data.gameName, data.gameId, data.gameType || selectedGame.id)
      } else {
        // Fallback for old API format
        onSetGameId(gameId.toUpperCase())
      }
    } catch (e: any) {
      setError(e.message || 'No se ha podido crear la partida. Prueba con otro nombre.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!selectedGame) return
    
    setError(null)
    if (!validateGameId(gameId)) {
      setError('Nombre de partida inválido. Usa letras, números, _ - .')
      return
    }
    
    setJoining(true)
    try {
      const response = await fetch(`${API_BASE}/game?gameName=${encodeURIComponent(gameId.toUpperCase())}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo encontrar la partida')
      }
      
      // API returns { message, gameName, gameId, gameType, createdAt }
      if (data.gameName && data.gameId) {
        onGameCreated(data.gameName, data.gameId, data.gameType || selectedGame.id)
      } else {
        throw new Error('Respuesta inválida del servidor')
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo unirse a la partida. Verifica el nombre e intenta nuevamente.')
    } finally {
      setJoining(false)
    }
  }

  // Game Catalog View
  if (!selectedGame) {
    return (
      <div className="w-full space-y-6">
        {/* Header with Stand Letters Logo */}
        <div className="flex flex-col items-center mb-6">
          {/* Stand Letters Logo - no background */}
          <img 
            src="/logo_stand_letters.png" 
            alt="Stand" 
            className="h-20 w-auto object-contain"
            onError={(e) => {
              // Fallback to stand-logo.png if logo_stand_letters.png doesn't exist
              const target = e.target as HTMLImageElement
              if (target.src !== `${window.location.origin}/stand-logo.png`) {
                target.src = '/stand-logo.png'
              }
            }}
          />
        </div>

        {/* Games Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-textMain text-center mb-4">Selecciona un juego</h2>
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameSelect(game)}
              className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:border-white/20 text-left"
            >
              <div className="flex items-center gap-4">
                {game.assets?.logo && (
                  <div className="flex-shrink-0">
                    <img 
                      src={game.assets.logo} 
                      alt={game.name} 
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-textMain mb-1">{game.name}</h3>
                  {game.description && (
                    <p className="text-sm text-textSub line-clamp-2">{game.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Create/Join Game View - Direct action buttons
  return (
    <div className="w-full space-y-4">
      {/* Back Button */}
      <button
        onClick={handleBackToCatalog}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-textMain transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al catálogo
      </button>

      {/* Selected Game Info */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
        {selectedGame.assets?.logo && (
          <img 
            src={selectedGame.assets.logo} 
            alt={selectedGame.name} 
            className="h-12 w-12 object-contain"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold text-textMain">{selectedGame.name}</h3>
          {selectedGame.description && (
            <p className="text-sm text-textSub">{selectedGame.description}</p>
          )}
        </div>
      </div>

      {/* Game ID Input */}
      <div className="space-y-2">
        <label htmlFor="game-id" className="text-sm text-gray-300">Nombre de la partida</label>
        <input
          id="game-id"
          value={gameId}
          onChange={(e)=>setGameId(e.target.value.toUpperCase())}
          placeholder="ej. TORNEO_1"
          className="w-full h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 outline-none focus:border-white/20 uppercase"
        />
        <p className="text-xs text-gray-400">Caracteres permitidos: letras, números, _ - .</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      {/* Action Buttons - Direct actions */}
      <div className="flex gap-3">
        <button
          onClick={handleCreate}
          disabled={loading || !gameId.trim()}
          className="flex-1 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Creando...' : 'Crear'}
        </button>
        <button
          onClick={handleJoin}
          disabled={joining || !gameId.trim()}
          className="flex-1 p-4 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {joining ? 'Buscando...' : 'Unirse'}
        </button>
      </div>
    </div>
  )
}
