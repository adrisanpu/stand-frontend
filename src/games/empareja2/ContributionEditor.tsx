import { useEffect, useState } from 'react'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { MAX_DRAFT_PAIRS, newId, newPair, type DraftPair } from './contributions'

function Preview({ file }: { file: File | null }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) { setUrl(''); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url ? <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null
}

export default function ContributionEditor({ pairs, onChange }: { pairs: DraftPair[]; onChange: (pairs: DraftPair[]) => void }) {
  const { t } = useOperatorLanguage()
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        {t('Las parejas se publicarán para todos al guardar. Puedes añadir hasta 10 parejas por guardado.', 'Pairs will be published for everyone when you save. You can add up to 10 pairs per save.')}
      </p>
      {pairs.map((pair, pairIndex) => (
        <fieldset key={pair.id} className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="text-sm text-gray-300">{t('Pareja nueva', 'New pair')} {pairIndex + 1}</legend>
          <div className="grid grid-cols-2 gap-3">
          {pair.characters.map((character, characterIndex) => {
            const label = `${t('Personaje', 'Character')} ${characterIndex + 1} · ${t('pareja', 'pair')} ${pairIndex + 1}`
            const update = (patch: Partial<typeof character>) => {
              const characters: DraftPair['characters'] = [...pair.characters]
              characters[characterIndex] = { ...character, ...patch }
              onChange(pairs.map((entry) => entry.id === pair.id ? { ...entry, characters } : entry))
            }
            return (
              <div key={characterIndex} className="min-w-0 space-y-2 rounded-lg bg-white/5 p-2">
                <p className="text-xs font-medium text-gray-300">{t('Personaje', 'Character')} {characterIndex + 1}</p>
                <Preview file={character.file} />
                <label className="block text-xs text-gray-300">{t('Nombre', 'Name')}
                  <input value={character.name} maxLength={80} onChange={(event) => update({ name: event.target.value })}
                    aria-label={`${label} · ${t('Nombre', 'Name')}`}
                    className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-transparent p-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-300">{t('Imagen', 'Image')}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => update({ file: event.target.files?.[0] ?? null, uploadId: newId() })}
                    aria-label={`${label} · ${t('Imagen', 'Image')}`}
                    className="mt-1 block w-full min-w-0 text-xs" />
                </label>
              </div>
            )
          })}
          </div>
          <button type="button" className="text-sm text-red-300 underline" onClick={() => onChange(pairs.filter((entry) => entry.id !== pair.id))}>
            {t('Eliminar pareja', 'Remove pair')}
          </button>
        </fieldset>
      ))}
      <button type="button" disabled={pairs.length >= MAX_DRAFT_PAIRS} onClick={() => onChange([...pairs, newPair()])}
        className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 disabled:opacity-50">
        {t('Añadir pareja', 'Add pair')}
      </button>
    </div>
  )
}
