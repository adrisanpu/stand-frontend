import { useState, useEffect, useCallback } from 'react'
import type { GameScreenProps } from '../../core/types'
import type { CardLayoutPosition } from './GameConfig'
import { api } from '../../api/api'
import QRCode from '../../core/widgets/QRCode'
import { getInstagramDmUrl } from '../../core/lib/instagram'
import { useGameInput } from '../../core/input/useGameInput'

const INFOCARDS_SETTINGS_KEY_PREFIX = 'infocards_settings_'
const CARD_CONTAINER_HEIGHT_CLASS = 'h-[340px] sm:h-[380px] lg:h-[410px]'
const INFOCARDS_JOIN_CARD_ID = '__infocards_join__'

type InfoCard = {
  id: string
  title: string
  body: string
  imageUrl?: string | null
  videoUrl?: string | null
  order?: number
  imagePositionX?: number
  imagePositionY?: number
}

type ApiResponse = {
  ok: boolean
  gameId: string
  cards: InfoCard[]
}

const VALID_POSITIONS: CardLayoutPosition[] = ['top', 'left', 'right', 'bottom']

function getCardLayouts(gameId: string): Record<string, CardLayoutPosition> {
  try {
    const key = `${INFOCARDS_SETTINGS_KEY_PREFIX}${gameId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved) as { cardLayouts?: Record<string, string> }
      const map = parsed.cardLayouts
      if (map && typeof map === 'object') {
        const result: Record<string, CardLayoutPosition> = {}
        for (const [id, pos] of Object.entries(map)) {
          if (VALID_POSITIONS.includes(pos as CardLayoutPosition)) {
            result[id] = pos as CardLayoutPosition
          }
        }
        return result
      }
    }
  } catch {
    /* ignore */
  }
  return {}
}

export default function InfocardsGameScreen({ gameId, orientation, sidebarElement }: GameScreenProps) {
  const [cards, setCards] = useState<InfoCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cardLayouts = getCardLayouts(gameId)

  const fetchCards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<ApiResponse>(`/v1/game/infocards?gameId=${encodeURIComponent(gameId)}`)
      const sorted = (data.cards || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setCards(sorted)
      setCurrentIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las tarjetas')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const joinCardVirtual: InfoCard = {
    id: INFOCARDS_JOIN_CARD_ID,
    title: 'Unirse a la partida',
    body: '',
  }
  const displayCards = cards.length > 0 ? [...cards, joinCardVirtual] : []

  const goToPrev = () => setCurrentIndex(i => (i > 0 ? i - 1 : displayCards.length - 1))
  const goToNext = () => setCurrentIndex(i => (i < displayCards.length - 1 ? i + 1 : 0))

  useGameInput(`infocards:${gameId}`, {
    left: () => {
      if (displayCards.length > 0) goToPrev()
    },
    right: () => {
      if (displayCards.length > 0) goToNext()
    },
    select: () => {
      if (displayCards.length > 0) goToNext()
    },
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-textSub text-sm animate-pulse">Cargando tarjetas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <p className="text-red-400 text-sm text-center">{error}</p>
        <button
          onClick={fetchCards}
          className="px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-textSub text-sm leading-relaxed">
          Configura el juego en Ajustes y sube contenido para generar las tarjetas informativas.
        </p>
      </div>
    )
  }

  const card = displayCards[currentIndex]
  const isJoinCard = card.id === INFOCARDS_JOIN_CARD_ID
  const layout: CardLayoutPosition = cardLayouts[card.id] ?? 'top'

  const cardContent = (
    <>
      <h2 className="text-xl sm:text-2xl font-bold text-textMain leading-tight">{card.title}</h2>
      <p className="text-textSub text-sm sm:text-base leading-relaxed whitespace-pre-line">{card.body}</p>
    </>
  )

  const hasMedia = !!(card.videoUrl || card.imageUrl)

  const mediaBlock = hasMedia ? (
    card.videoUrl ? (
      <video
        src={card.videoUrl}
        autoPlay
        loop
        muted
        playsInline
        controls
        className="w-full h-full object-cover rounded-xl"
        aria-label={card.title}
      />
    ) : (
      <img
        src={card.imageUrl!}
        alt={card.title}
        className="w-full h-full object-cover rounded-xl"
        style={{ objectPosition: `${card.imagePositionX ?? 50}% ${card.imagePositionY ?? 50}%` }}
      />
    )
  ) : null

  const mediaBlockFullWidth = hasMedia ? (
    card.videoUrl ? (
      <video
        src={card.videoUrl}
        autoPlay
        loop
        muted
        playsInline
        controls
        className="w-full max-h-40 sm:max-h-44 object-cover rounded-xl"
        aria-label={card.title}
      />
    ) : (
      <img
        src={card.imageUrl!}
        alt={card.title}
        className="w-full max-h-40 sm:max-h-44 object-cover rounded-xl"
        style={{ objectPosition: `${card.imagePositionX ?? 50}% ${card.imagePositionY ?? 50}%` }}
      />
    )
  ) : null

  const baseClass = 'w-full h-full min-h-0 rounded-2xl p-5 sm:p-6 flex flex-col gap-3'
  const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }

  const renderJoinCard = () => (
    <div key={INFOCARDS_JOIN_CARD_ID} className={baseClass} style={cardStyle}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-0 overflow-hidden">
        <div className="flex justify-center items-start">
          <QRCode
            data={getInstagramDmUrl(gameId)}
            size={380}
            margin={12}
            alt="QR Code para Instagram DM"
          />
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
          <ol className="space-y-4 text-base text-gray-300">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(99,102,241,0.2)] border border-[rgba(99,102,241,0.4)] flex items-center justify-center font-semibold text-[#6366F1] text-sm">1</span>
              <span className="pt-0.5">Escanea el QR y pulsa JUGAR en el chat de Instagram para unirte.</span>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(99,102,241,0.2)] border border-[rgba(99,102,241,0.4)] flex items-center justify-center font-semibold text-[#6366F1] text-sm">2</span>
              <span className="pt-0.5">En el chat podrás hacer un pequeño quiz y demostrar lo aprendido.</span>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(99,102,241,0.2)] border border-[rgba(99,102,241,0.4)] flex items-center justify-center font-semibold text-[#6366F1] text-sm">3</span>
              <span className="pt-0.5">Participa en los sorteos.</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )

  const rowClassGrid = 'w-full h-full min-h-0 rounded-2xl p-5 sm:p-6 grid grid-cols-2 gap-4 sm:gap-5 overflow-hidden'

  const renderCard = () => {
    if (layout === 'top') {
      return (
        <div key={card.id} className={baseClass} style={cardStyle}>
          {mediaBlockFullWidth && (
            <div className="w-full rounded-xl overflow-hidden flex-shrink-0">{mediaBlockFullWidth}</div>
          )}
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">{cardContent}</div>
        </div>
      )
    }
    if (layout === 'bottom') {
      return (
        <div key={card.id} className={baseClass} style={cardStyle}>
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">{cardContent}</div>
          {mediaBlockFullWidth && (
            <div className="w-full rounded-xl overflow-hidden flex-shrink-0">{mediaBlockFullWidth}</div>
          )}
        </div>
      )
    }
    if (layout === 'left') {
      return (
        <div key={card.id} className={rowClassGrid} style={cardStyle}>
          {mediaBlock && (
            <div className="min-w-0 h-full rounded-xl overflow-hidden">{mediaBlock}</div>
          )}
          <div className="flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto">{cardContent}</div>
        </div>
      )
    }
    // right
    return (
      <div key={card.id} className={rowClassGrid} style={cardStyle}>
        <div className="flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto">{cardContent}</div>
        {mediaBlock && (
          <div className="min-w-0 h-full rounded-xl overflow-hidden">{mediaBlock}</div>
        )}
      </div>
    )
  }

  const isLandscape = orientation === 'landscape' && sidebarElement != null
  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,260px)] gap-3 sm:gap-4 lg:gap-5 items-stretch h-full min-h-0 w-full">
        <div className="card flex flex-col p-4 sm:p-5 overflow-hidden min-h-0 items-center justify-between gap-3">
          <div className={`w-full flex-shrink-0 ${CARD_CONTAINER_HEIGHT_CLASS}`}>
            {isJoinCard ? renderJoinCard() : renderCard()}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={goToPrev} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Tarjeta anterior">
              <svg className="w-5 h-5 text-textSub" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex gap-2">
              {displayCards.map((_, idx) => (
                <button key={idx} onClick={() => setCurrentIndex(idx)} className="rounded-full transition-all duration-200" style={{ width: idx === currentIndex ? '20px' : '8px', height: '8px', background: idx === currentIndex ? 'var(--color-primary, #6366F1)' : 'rgba(255,255,255,0.2)' }} aria-label={`Ir a tarjeta ${idx + 1}`} />
              ))}
            </div>
            <button onClick={goToNext} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Tarjeta siguiente">
              <svg className="w-5 h-5 text-textSub" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full">
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full min-w-0 bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Card */}
      <div className={`w-full flex-shrink-0 ${CARD_CONTAINER_HEIGHT_CLASS}`}>
        {isJoinCard ? renderJoinCard() : renderCard()}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={goToPrev}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Tarjeta anterior"
        >
          <svg className="w-5 h-5 text-textSub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="flex gap-2">
          {displayCards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="rounded-full transition-all duration-200"
              style={{
                width: idx === currentIndex ? '20px' : '8px',
                height: '8px',
                background: idx === currentIndex ? 'var(--color-primary, #6366F1)' : 'rgba(255,255,255,0.2)',
              }}
              aria-label={`Ir a tarjeta ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goToNext}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Tarjeta siguiente"
        >
          <svg className="w-5 h-5 text-textSub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  )
}
