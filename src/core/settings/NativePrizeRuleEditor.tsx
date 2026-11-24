import { Fragment, useEffect, useState, type ReactNode } from 'react'
import type { SharedPrize } from '../../api/sharedPrizeCatalog'
import type { PrizeInventory } from '../../api/prizeInventory'
import type { PrizeSlot } from '../prizes'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import IconButton from '../ui/IconButton'
import type { OperatorPrizeSlotVisibility } from './operatorPrizeSlots'

export type NativePrizeDraft = {
  name: string
  limit: string
  topX: string
  imageKey: string | null
  imageUrl: string | null
  sharedPrizeId: string
}

const field = 'h-9 min-w-0 rounded-md border border-current/20 bg-surface px-2 text-sm text-textMain'
const slotOrder: PrizeSlot[] = ['validation', 'ranking', 'raffle']
const emptyPrize = (): NativePrizeDraft => ({
  name: '', limit: '', topX: '3', imageKey: null, imageUrl: null, sharedPrizeId: '',
})

export default function NativePrizeRuleEditor({ slots, drafts, available, inventory, onChange, onMove, errors, onValidityChange, headerAside }: {
  slots: OperatorPrizeSlotVisibility
  drafts: Record<PrizeSlot, NativePrizeDraft>
  available: SharedPrize[]
  inventory: PrizeInventory | null
  onChange: (slot: PrizeSlot, patch: Partial<NativePrizeDraft>) => void
  onMove: (from: PrizeSlot, to: PrizeSlot) => void
  errors: Partial<Record<PrizeSlot, boolean>>
  onValidityChange: (valid: boolean) => void
  headerAside?: ReactNode
}) {
  const { t } = useOperatorLanguage()
  const supported = slotOrder.filter(slot => slots[slot])
  const [rules, setRules] = useState(() => supported.filter(slot => drafts[slot].name || drafts[slot].sharedPrizeId))
  const [selected, setSelected] = useState<PrizeSlot | null>(() => rules[0] ?? null)
  const unused = supported.filter(slot => !rules.includes(slot))
  const valid = rules.every(slot => !!drafts[slot].name.trim())
  useEffect(() => { onValidityChange(valid) }, [valid, onValidityChange])
  const condition = (slot: PrizeSlot) => ({
    validation: t('valide su participación', 'a player validates participation'),
    ranking: t('esté en el top del ranking', 'a player is in the leaderboard top'),
    raffle: t('gane un sorteo', 'a player wins a raffle'),
  })[slot]
  return <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-2 md:items-center">
      <div className="flex items-center gap-2">
        <IconButton icon="add" label={t('Añadir regla', 'Add rule')} disabled={!unused.length || !available.length}
          onClick={() => {
            const slot = unused[0]
            if (!slot) return
            setRules(current => [...current, slot])
            setSelected(slot)
            onChange(slot, {})
          }} />
        <p className="text-xs text-textSub">{t(
          'Cada condición admite un premio por participante. Solo se muestran las condiciones compatibles con este juego.',
          'Each condition supports one prize per participant. Only conditions supported by this game are shown.',
        )}</p>
      </div>
      {headerAside}
    </div>
    {!valid && <p role="status" className="text-xs text-textSub">{t(
      'Selecciona un premio o elimina esta regla antes de guardar.',
      'Select a prize or remove this rule before saving.',
    )}</p>}
    {!!rules.length && <div className="overflow-x-auto">
      <table className="admin-table w-full text-left text-sm" aria-label={t('Condiciones', 'Conditions')}>
        <thead><tr>
          <th scope="col" className="p-2"><span className="sr-only">{t('Selección', 'Selection')}</span></th>
          {[t('Condición', 'Condition'), t('Parámetros', 'Parameters'), t('Premios', 'Prizes'), '']
            .map((heading, index) => <th key={index} scope="col" className="whitespace-nowrap p-2">{heading}</th>)}
        </tr></thead>
        <tbody>{rules.map((slot, index) => {
          const draft = drafts[slot]
          const isSelected = selected === slot
          const item = inventory?.catalog.find(prize => prize.id === draft.sharedPrizeId)
          return <Fragment key={slot}>
            <tr className={`border-t border-current/10 ${isSelected ? 'bg-primary/5' : ''}`}>
              <td className="w-10 p-2">
                <input type="radio" name="reward-rule-selection" checked={isSelected}
                  className="h-4 w-4 accent-primary" aria-label={`${t('Seleccionar regla', 'Select rule')} ${index + 1}`}
                  onClick={() => setSelected(isSelected ? null : slot)} onChange={() => undefined} />
              </td>
              <td className="p-2">
                <select aria-label={`${t('Condición', 'Condition')} ${index + 1}`} className={`${field} min-w-[12rem] w-full`}
                  value={slot} onChange={event => {
                    const target = supported.find(candidate => candidate === event.target.value)
                    if (!target || target === slot || rules.includes(target)) return
                    onMove(slot, target)
                    setRules(current => current.map(value => value === slot ? target : value))
                    setSelected(target)
                  }}>
                  {supported.map(value => <option key={value} value={value}
                    disabled={value !== slot && rules.includes(value)}>{condition(value)}</option>)}
                </select>
              </td>
              <td className="p-2">{slot === 'ranking' ? <input type="number" min={1} max={100}
                aria-label={t('Puestos premiados (top)', 'Rewarded positions (top)')}
                className={`${field} w-20`} value={draft.topX} aria-invalid={!!errors[slot]}
                onChange={event => onChange(slot, { topX: event.target.value })} /> : <span className="text-textSub">—</span>}</td>
              <td className="p-2 text-textSub">
                <button type="button" className="text-left underline" onClick={() => setSelected(isSelected ? null : slot)}>
                  {draft.name || t('Seleccionar premio…', 'Select prize…')}{draft.name && ' ×1'}
                </button>
              </td>
              <td className="w-10 p-2">
                <IconButton icon="delete" className="!h-8 !w-8" label={`${t('Quitar regla', 'Remove rule')} ${index + 1}`}
                  onClick={() => {
                    onChange(slot, emptyPrize())
                    setRules(current => current.filter(value => value !== slot))
                    if (isSelected) setSelected(null)
                  }} />
              </td>
            </tr>
            {isSelected && <tr className="bg-primary/5"><td colSpan={5} className="px-3 pb-3">
              <section aria-label={`${t('Premios de la regla', 'Rule prizes')} ${index + 1}`} className="space-y-2 py-2">
                <table className="admin-table w-full text-left text-sm">
                  <thead><tr>{[t('Premio', 'Prize'), t('Substock', 'Sub-stock'), t('Cantidad por victoria', 'Quantity per win')]
                    .map(heading => <th key={heading} scope="col" className="whitespace-nowrap p-2">{heading}</th>)}</tr></thead>
                  <tbody><tr className="border-t border-current/10">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-contain" />}
                        <select aria-label={`${t('Premio de la regla', 'Rule prize')} ${index + 1}`}
                          className={`${field} w-full min-w-[10rem]`} value={draft.sharedPrizeId || (draft.name ? 'legacy' : '')}
                          onChange={event => {
                            const prize = available.find(item => item.id === event.target.value)
                            onChange(slot, { sharedPrizeId: prize?.id ?? '', name: prize?.name ?? '',
                              imageKey: prize?.imageKey ?? null, imageUrl: prize?.imageUrl ?? null })
                          }}>
                          <option value="">{t('Sin premio asignado', 'No prize assigned')}</option>
                          {draft.name && !available.some(prize => prize.id === draft.sharedPrizeId) &&
                            <option value={draft.sharedPrizeId || 'legacy'}>{draft.name}</option>}
                          {available.map(prize => <option key={prize.id} value={prize.id}>{prize.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="p-2"><input inputMode="numeric" className={`${field} w-24`}
                      aria-label={`${t('Substock de la regla', 'Rule sub-stock')} ${index + 1}`} aria-invalid={!!errors[slot]}
                      placeholder={t('Sin reserva', 'No reservation')} value={draft.limit}
                      onChange={event => onChange(slot, { limit: event.target.value })} /></td>
                    <td className="p-2">1</td>
                  </tr></tbody>
                </table>
                <p className="text-xs text-textSub">{t(
                  'Reserva exclusiva de esta partida. Vacío no reserva unidades; 0 no reparte este premio.',
                  'Exclusive reservation for this event. Blank reserves no units; 0 does not award this prize.',
                )}</p>
                {draft.sharedPrizeId && <p className="text-xs text-textSub">{t('Disponible general', 'General available')}: {
                  item?.reservation ? item.reservation.available ?? t('Define los substocks', 'Set sub-stocks')
                    : item?.inventory.initialized ? item.inventory.available : t('Sin reserva', 'No reservation')
                }</p>}
              </section>
            </td></tr>}
            {errors[slot] && <tr><td colSpan={5} role="alert" className="p-2 text-red-300">{t(
              'El substock debe ser un entero ≥ 0 o vacío. Top debe ser un entero entre 1 y 100.',
              'Sub-stock must be a whole number ≥ 0 or empty. Top must be a whole number from 1 to 100.',
            )}</td></tr>}
          </Fragment>
        })}</tbody>
      </table>
    </div>}
  </div>
}
