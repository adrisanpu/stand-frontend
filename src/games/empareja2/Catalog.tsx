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
    <section aria-label={t('Catálogo de parejas', 'Pairs catalog')} className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-sm font-medium text-gray-300">{t('Catálogo de parejas', 'Pairs catalog')}</h3>
      {error && <p role="alert" className="text-sm text-red-300">{t('No se pudo cargar el catálogo de parejas.', 'Could not load the pairs catalog.')}</p>}
      {!pairs && !error && <p role="status" className="text-sm text-gray-400">{t('Cargando parejas...', 'Loading pairs...')}</p>}
      {pairs && pairs.length === 0 && <p className="text-sm text-gray-400">{t('No hay parejas disponibles.', 'There are no pairs available.')}</p>}
      {pairs && pairs.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pairs.map((pair, index) => (
            <li key={pair.id} className="rounded-xl border border-white/10 p-3">
              <p className="mb-2 text-xs text-gray-400">
                {selected == null
                  ? t('Cargando dificultad...', 'Loading difficulty...')
                  : index < selected ? t('Disponible para repartir', 'Available for assignment') : t('Fuera del límite', 'Outside limit')}
              </p>
              <div className="flex flex-wrap gap-4">
                {pair.characters.map((character) => (
                  <div key={character.id} className="flex items-center gap-2 text-sm text-gray-200">
                    <img src={character.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                    <span>{character.name}</span>
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
