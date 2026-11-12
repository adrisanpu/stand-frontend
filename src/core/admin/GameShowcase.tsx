import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { GameDefinition } from '../types'
import { useOperatorLanguage } from '../shell/operatorLanguage'

const SLOT = 192
const VISIBLE = 2
const fade = 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'

type Props = {
  games: GameDefinition[]
  counts: Record<string, number>
  selectedId: string
  onSelect: (id: string) => void
  onOpen?: () => void
}

export default function GameShowcase({ games, counts, selectedId, onSelect, onOpen }: Props) {
  const { t } = useOperatorLanguage()
  const total = games.length
  const selectedIndex = Math.max(0, games.findIndex(game => game.id === selectedId))
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const moved = useRef(false)

  const move = (steps: number) => {
    if (!total || !steps) return
    onSelect(games[(((selectedIndex + steps) % total) + total) % total].id)
  }
  const offsetOf = (index: number) => {
    let offset = index - selectedIndex
    if (offset > total / 2) offset -= total
    if (offset < -total / 2) offset += total
    return offset
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = event.clientX
    moved.current = false
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return
    const dx = event.clientX - start.current
    if (Math.abs(dx) > 6 && !moved.current) {
      moved.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (moved.current) setDrag(dx)
  }
  const endDrag = () => {
    if (start.current === null) return
    start.current = null
    const steps = Math.round(-drag / SLOT)
    setDrag(0)
    move(steps)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
  }

  const arrow = 'z-10 shrink-0 rounded-full border border-current/20 bg-surface p-2 text-textMain disabled:opacity-40'
  const selected = games[selectedIndex]

  return (
    <section aria-label={t('Catálogo de juegos', 'Game catalog')} className="w-full space-y-1">
      <div className="flex w-full min-w-0 items-center gap-2">
        <button type="button" className={arrow} aria-label={t('Juego anterior', 'Previous game')} onClick={() => move(-1)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <div role="listbox" tabIndex={0} aria-label={t('Juegos', 'Games')} aria-activedescendant={selected ? `showcase-${selected.id}` : undefined}
          onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          className="relative h-48 min-w-0 flex-1 cursor-grab touch-pan-y select-none overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
          style={{ maskImage: fade, WebkitMaskImage: fade }}>
          {games.map((game, index) => {
            const offset = offsetOf(index)
            const distance = Math.abs(offset)
            const center = offset === 0
            const scale = center ? 1.05 : distance === 1 ? 0.8 : 0.65
            const count = counts[game.id] ?? 0
            return (
              <div key={game.id} id={`showcase-${game.id}`} role="option" aria-selected={center} aria-label={`${game.name} (${count})`}
                onClick={() => { if (!moved.current) move(offset) }}
                className={`absolute left-1/2 top-1/2 flex h-40 w-40 cursor-pointer items-center justify-center ${drag ? '' : 'transition-all duration-300 ease-out'}`}
                style={{
                  transform: `translate(calc(-50% + ${offset * SLOT + drag}px), -50%) scale(${scale})`,
                  opacity: distance > VISIBLE ? 0 : center ? 1 : distance === 1 ? 0.7 : 0.4,
                  pointerEvents: distance > VISIBLE ? 'none' : undefined,
                  zIndex: 10 - distance,
                }}>
                <div className={`group relative flex h-full w-full items-center justify-center rounded-2xl border bg-surface p-2 ${center
                  ? 'border-primary shadow-lg shadow-primary/30' : 'border-current/10'}`}>
                  {game.assets?.logo
                    ? <img src={game.assets.logo} alt="" draggable={false} className="h-full w-full object-contain" />
                    : <span aria-hidden="true" className="text-xl font-semibold">{game.id.slice(0, 2)}</span>}
                  <span aria-hidden="true" className={`absolute -right-2 -top-2 min-w-[1.5rem] rounded-full px-1.5 text-center text-xs font-semibold leading-6 tabular-nums ${count
                    ? 'bg-primary text-white' : 'bg-current/10 text-textSub'}`}>{count}</span>
                  {center && onOpen && <button type="button" aria-label={t(`Ver explicación y crear partida de ${game.name}`, `View guide and create a ${game.name} event`)}
                    title={t('Explicación y crear partida', 'Guide and create event')}
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => { event.stopPropagation(); onOpen() }}
                    className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-12 w-12">
                      <path d="M12 6.5C10.5 5.3 8.4 4.7 5.5 4.7c-.8 0-1.5.1-2 .2v13.6c.6-.1 1.2-.2 2-.2 2.9 0 5 .6 6.5 1.8 1.5-1.2 3.6-1.8 6.5-1.8.8 0 1.4.1 2 .2V4.9c-.5-.1-1.2-.2-2-.2-2.9 0-5 .6-6.5 1.8Zm0 0v13.6" />
                    </svg>
                  </button>}
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" className={arrow} aria-label={t('Juego siguiente', 'Next game')} onClick={() => move(1)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      {selected && <p aria-live="polite" className="text-center text-sm font-semibold">{selected.name}</p>}
    </section>
  )
}
