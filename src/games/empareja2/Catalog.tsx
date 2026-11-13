import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'

type Character = { id: number; name: string; imageUrl: string }
type Pair = { id: string; characters: Character[] }

export default function Catalog({ gameId, selected, revision = 0, onPublishedCount }: {
  gameId?: string | null; selected: number | null; revision?: number; onPublishedCount?: (count: number) => void
}) {
  const { t } = useOperatorLanguage()
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    setPairs(null)
    setError(false)
    api.get<{ ok: boolean; pairs: Pair[] }>(`/v1/game/empareja2/catalog?gameId=${encodeURIComponent(gameId)}`)
      .then((response) => {
        if (!response.ok || !Array.isArray(response.pairs)) throw new Error('Invalid catalog response')
        if (!cancelled) {
          setPairs(response.pairs)
          if (revision > 0) onPublishedCount?.(response.pairs.length)
        }
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [gameId, revision, onPublishedCount])

  if (!gameId) return null
  return (
    <section aria-label={t('Catálogo de parejas', 'Pairs catalog')} className="space-y-3 border-t border-current/10 pt-4">
      <h3 className="text-sm font-medium text-textMain">{t('Catálogo de parejas', 'Pairs catalog')}</h3>
      {error && <p role="alert" className="text-sm text-red-300">{t('No se pudo cargar el catálogo de parejas.', 'Could not load the pairs catalog.')}</p>}
      {!pairs && !error && <p role="status" className="text-sm text-textSub">{t('Cargando parejas...', 'Loading pairs...')}</p>}
      {pairs && pairs.length === 0 && <p className="text-sm text-textSub">{t('No hay parejas disponibles.', 'There are no pairs available.')}</p>}
      {pairs && pairs.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {pairs.map((pair, index) => (
            <li key={pair.id} className={`rounded-xl border p-2 transition-opacity transition-colors ${
              selected != null && index < selected ? 'border-primary/30 bg-primary/20' : 'border-current/10 bg-surface'
            } ${
              selected != null && index >= selected ? 'opacity-50 hover:opacity-100 focus-within:opacity-100' : ''
            }`}>
              <span className="sr-only">
                {selected == null
                  ? t('Cargando dificultad...', 'Loading difficulty...')
                  : index < selected ? t('Disponible para repartir', 'Available for assignment') : t('Fuera del límite', 'Outside limit')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {pair.characters.map((character) => (
                  <div key={character.id} tabIndex={0} aria-label={character.name}
                    className="group relative flex min-w-0 justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <img src={character.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 z-10 hidden max-w-full -translate-x-1/2 translate-y-full break-words rounded bg-surface px-2 py-1 text-center text-xs text-textMain shadow-lg group-hover:block group-focus:block">
                      {character.name}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
