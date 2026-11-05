import type { StackPrizeCondition, StackPrizeItem, StackPrizeRule, StackPrizeScoreOperator } from '../../api/stackPrizes'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import IconButton from '../ui/IconButton'

const field = 'h-9 min-w-0 rounded-xl border border-white/10 bg-white/5 px-2.5 text-sm'
const conditions: StackPrizeCondition[] = ['completed', 'top_finish', 'top_final', 'raffle', 'score']
const operators: StackPrizeScoreOperator[] = ['>', '>=', '=', '<=', '<', 'between']

export function invalidStackRules(rules: StackPrizeRule[]): boolean {
  return rules.length > 8 || rules.some(rule =>
    rule.groups.length === 0 || rule.groups.some(group => group.allocations.length === 0
      || group.allocations.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10))
    || (rule.condition.startsWith('top_') && (!Number.isInteger(rule.topX) || (rule.topX ?? 0) < 1 || (rule.topX ?? 101) > 100))
    || (rule.condition === 'score' && (!Number.isSafeInteger(rule.scoreValue) || (rule.scoreValue ?? -1) < 0
      || (rule.scoreOperator === 'between' && (!Number.isSafeInteger(rule.scoreMaxValue)
        || (rule.scoreMaxValue ?? -1) < (rule.scoreValue ?? 0))))))
}

export default function StackRuleEditor({ rules, catalog, available = catalog, raffles, onChange, onAddPrize }: {
  rules: StackPrizeRule[]
  catalog: StackPrizeItem[]
  available?: StackPrizeItem[]
  raffles: boolean
  onChange: (rules: StackPrizeRule[]) => void
  onAddPrize?: (ruleIndex: number, groupIndex: number, prizeId: string) => void
}) {
  const { t } = useOperatorLanguage()
  const label = (condition: StackPrizeCondition) => ({
    completed: t('complete una partida', 'a player completes a game'),
    top_finish: t('entre en el top al terminar su partida', 'a player finishes in the top'),
    top_final: t('esté en el top al cerrar el juego', 'a player is in the top when the game closes'),
    raffle: t('gane un sorteo', 'a player wins a raffle'),
    score: t('consiga una puntuación', 'a player reaches a score'),
  })[condition]
  const update = (index: number, rule: StackPrizeRule) => onChange(
    rules.map((old, i) => i === index ? { ...rule, id: crypto.randomUUID() } : old),
  )
  const addRule = () => onChange([...rules, { id: crypto.randomUUID(), condition: 'completed', groups: [{ allocations: [] }] }])
  return <div className="space-y-2">
    {rules.map((rule, index) => <section key={index} aria-label={`${t('Regla', 'Rule')} ${index + 1}`}
      className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-textSub">
        <span className="shrink-0">{t('Condición', 'Condition')} {index + 1}</span>
        <select className={`${field} flex-1 text-textMain`} value={rule.condition} onChange={event => {
          const condition = event.target.value as StackPrizeCondition
          update(index, { ...rule, condition, topX: condition.startsWith('top_') ? 10 : undefined,
            scoreOperator: condition === 'score' ? '>=' : undefined, scoreValue: undefined, scoreMaxValue: undefined })
        }}>
          {conditions.filter(condition => condition !== 'raffle' || raffles || rule.condition === 'raffle')
            .map(condition => <option key={condition} value={condition}>{label(condition)}</option>)}
        </select>
      </label>
      {rule.condition.startsWith('top_') && <label className="block space-y-1 text-xs font-medium text-textSub">Top {index + 1}
        <input type="number" min={1} max={100} className={`${field} block w-full text-textMain`}
          value={Number.isFinite(rule.topX) ? rule.topX : ''} onChange={event => update(index, { ...rule, topX: event.target.valueAsNumber })} />
      </label>}
      {rule.condition === 'score' && <>
        <label className="space-y-1 text-xs font-medium text-textSub">{t('Operador de puntuación', 'Score operator')} {index + 1}
          <select className={`${field} block w-full text-textMain`} value={rule.scoreOperator ?? '>='}
            onChange={event => update(index, { ...rule, scoreOperator: event.target.value as StackPrizeScoreOperator,
              scoreMaxValue: event.target.value === 'between' ? rule.scoreMaxValue : undefined })}>
            {operators.map(operator => <option key={operator} value={operator}>{operator === 'between' ? t('entre', 'between') : operator}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-textSub">{t('Puntuación mínima', 'Score value')} {index + 1}
          <input type="number" min={0} step={1} className={`${field} block w-full text-textMain`} value={Number.isSafeInteger(rule.scoreValue) ? rule.scoreValue : ''}
            onChange={event => update(index, { ...rule, scoreValue: event.target.valueAsNumber })} />
        </label>
        {rule.scoreOperator === 'between' && <label className="space-y-1 text-xs font-medium text-textSub">{t('Puntuación máxima', 'Score maximum')} {index + 1}
          <input type="number" min={0} step={1} className={`${field} block w-full text-textMain`} value={Number.isSafeInteger(rule.scoreMaxValue) ? rule.scoreMaxValue : ''}
            onChange={event => update(index, { ...rule, scoreMaxValue: event.target.valueAsNumber })} />
        </label>}
      </> }
      </div>
      <div className="flex shrink-0 gap-2">
        <IconButton icon="add" label={t('Añadir regla', 'Add rule')} disabled={rules.length >= 8 || !available.length}
          onClick={addRule} />
        <IconButton icon="delete" label={`${t('Quitar regla', 'Remove rule')} ${index + 1}`}
          onClick={() => onChange(rules.filter((_, i) => i !== index))} />
      </div>
      </div>
      {rule.groups.map((group, groupIndex) => <div key={groupIndex} className="space-y-3 rounded-xl border border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="shrink-0 text-xs font-semibold text-textSub">{groupIndex > 0 ? t('O', 'OR') + ' · ' : ''}{t('Grupo', 'Group')} {groupIndex + 1}</p>
          <select className={`${field} flex-1`} aria-label={`${t('Añadir premio al grupo', 'Add prize to group')} ${index + 1}.${groupIndex + 1}`}
            value="" disabled={group.allocations.length >= 8} onChange={event => {
              const id = event.target.value
              if (!id) return
              if (onAddPrize) onAddPrize(index, groupIndex, id)
              else update(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex
                ? { allocations: [...item.allocations, { prizeId: id, quantity: 1 }] } : item) })
            }}>
            <option value="">{t('Seleccionar premio…', 'Select prize…')}</option>
            {available.filter(prize => !group.allocations.some(item => item.prizeId === prize.id))
              .map(prize => <option key={prize.id} value={prize.id}>{prize.name}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 gap-2">
          <IconButton icon="group" label={t('O añadir grupo', 'OR add group')} disabled={rule.groups.length >= 8}
            onClick={() => update(index, { ...rule, groups: [...rule.groups, { allocations: [] }] })} />
          {rule.groups.length > 1 && <IconButton icon="delete" label={`${t('Quitar grupo', 'Remove group')} ${index + 1}.${groupIndex + 1}`}
            onClick={() => update(index, { ...rule, groups: rule.groups.filter((_, i) => i !== groupIndex) })} />}
        </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.allocations.map((allocation, allocationIndex) => {
          const prize = catalog.find(item => item.id === allocation.prizeId)
          return <div key={allocation.prizeId} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm" title={`${allocationIndex > 0 ? `${t('Y', 'AND')} ` : ''}${prize?.name ?? allocation.prizeId}`}>
              {allocationIndex > 0 ? `${t('Y', 'AND')} · ` : ''}{prize?.name ?? allocation.prizeId}
            </span>
            <label className="shrink-0 text-[11px] text-textSub">{t('Cantidad', 'Qty.')}
              <input type="number" min={1} max={10} aria-label={`${t('Cantidad de', 'Quantity of')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
                className={`${field} ml-1 w-16 text-textMain`}
                value={Number.isFinite(allocation.quantity) ? allocation.quantity : ''} onChange={event => update(index, {
                  ...rule, groups: rule.groups.map((item, i) => i === groupIndex ? {
                    allocations: item.allocations.map((entry, n) => n === allocationIndex ? { ...entry, quantity: event.target.valueAsNumber } : entry),
                  } : item),
                })} />
            </label>
            <IconButton icon="remove"
              label={`${t('Quitar premio', 'Remove prize')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
              onClick={() => update(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex
                ? { allocations: item.allocations.filter((_, n) => n !== allocationIndex) } : item) })} />
          </div>
        })}
        </div>
        {!group.allocations.length && <p className="text-sm">{t('Selecciona al menos un premio.', 'Select at least one prize.')}</p>}
      </div>)}
      <p className="text-xs text-textSub">{t(
        'Sale un grupo al azar, con la misma probabilidad. Se entregan sus premios disponibles; los grupos agotados no participan.',
        'One group is chosen at random with equal probability. Its available prizes are awarded; exhausted groups are excluded.',
      )}</p>
    </section>)}
    {!rules.length && <IconButton icon="add" label={t('Añadir regla', 'Add rule')} disabled={!available.length}
      onClick={addRule} />}
  </div>
}
