import { Fragment, useState, type MouseEvent, type ReactNode } from 'react'
import type { StackAutoCloseDuration, StackPrizeCondition, StackPrizeItem, StackPrizeRule, StackPrizeScoreOperator } from '../../api/stackPrizes'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import IconButton from '../ui/IconButton'

const field = 'h-9 min-w-0 rounded-md border border-current/20 bg-surface px-2 text-sm text-textMain'
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

const interactive = (event: MouseEvent) => !!(event.target as HTMLElement).closest('input,select,button,label')

export default function StackRuleEditor({ rules, catalog, available = catalog, raffles, onChange, onAddPrize, stock, onStockChange, headerAside, autoClose }: {
  rules: StackPrizeRule[]
  catalog: StackPrizeItem[]
  available?: StackPrizeItem[]
  raffles: boolean
  onChange: (rules: StackPrizeRule[]) => void
  onAddPrize?: (ruleIndex: number, groupIndex: number, prizeId: string) => void
  /** Per-event sub-stock drafts by catalog prize id; enables the editable Substock column. */
  stock?: Record<string, string>
  onStockChange?: (prizeId: string, value: string) => void
  headerAside?: ReactNode
  autoClose?: {
    duration: StackAutoCloseDuration | null
    savedAt?: number
    onChange: (duration: StackAutoCloseDuration | null) => void
  }
}) {
  const { t } = useOperatorLanguage()
  const [selected, setSelected] = useState<number | null>(rules.length ? 0 : null)
  const label = (condition: StackPrizeCondition) => ({
    completed: t('complete una partida', 'a player completes a game'),
    top_finish: t('entre en el top al terminar su partida', 'a player finishes in the top'),
    top_final: t('esté en el top al cerrar el juego', 'a player is in the top when the game closes'),
    raffle: t('gane un sorteo', 'a player wins a raffle'),
    score: t('consiga una puntuación', 'a player reaches a score'),
  })[condition]
  const name = (prizeId: string) => catalog.find(item => item.id === prizeId)?.name ?? prizeId
  const update = (index: number, rule: StackPrizeRule) => onChange(
    rules.map((old, i) => i === index ? { ...rule, id: crypto.randomUUID() } : old),
  )
  const addRule = () => {
    onChange([...rules, { id: crypto.randomUUID(), condition: 'completed', groups: [{ allocations: [] }] }])
    setSelected(rules.length)
  }
  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
    setSelected(current => current === null || current === index ? null : current > index ? current - 1 : current)
  }
  const toggle = (index: number) => setSelected(current => current === index ? null : index)
  const withSubstock = !!stock && !!onStockChange
  const summary = (rule: StackPrizeRule) => rule.groups
    .map(group => group.allocations.map(item => `${name(item.prizeId)} ×${Number.isFinite(item.quantity) ? item.quantity : '?'}`)
      .join(` ${t('Y', 'AND')} `) || '—')
    .join(` · ${t('O', 'OR')} · `)

  const detail = (rule: StackPrizeRule, index: number) => <section aria-label={`${t('Premios de la regla', 'Rule prizes')} ${index + 1}`} className="space-y-2 py-2">
    <table className="admin-table w-full text-left text-sm">
      <thead><tr>
        {[t('Grupo', 'Group'), t('Premio', 'Prize'), ...(withSubstock ? [t('Substock', 'Sub-stock')] : []),
          t('Cantidad por victoria', 'Quantity per win'), '']
          .map((heading, i) => <th key={i} scope="col" className="whitespace-nowrap p-2">{heading}</th>)}
      </tr></thead>
      <tbody>{rule.groups.map((group, groupIndex) => {
        const key = `${index + 1}.${groupIndex + 1}`
        const setGroup = (allocations: typeof group.allocations) => update(index, {
          ...rule, groups: rule.groups.map((item, i) => i === groupIndex ? { allocations } : item),
        })
        const options = available.filter(prize => !group.allocations.some(item => item.prizeId === prize.id))
        return <Fragment key={groupIndex}>
          {group.allocations.map((allocation, allocationIndex) => {
            const prizeName = name(allocation.prizeId)
            return <tr key={allocation.prizeId} className={allocationIndex ? '' : 'border-t border-current/10'}>
              {allocationIndex === 0 && <th scope="rowgroup" rowSpan={group.allocations.length + 1} className="p-2 align-top">
                <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-textSub">
                  {groupIndex > 0 ? `${t('O', 'OR')} · ` : ''}{t('Grupo', 'Group')} {groupIndex + 1}
                  {rule.groups.length > 1 && <IconButton icon="delete" className="!h-8 !w-8"
                    label={`${t('Quitar grupo', 'Remove group')} ${key}`}
                    onClick={() => update(index, { ...rule, groups: rule.groups.filter((_, i) => i !== groupIndex) })} />}
                </span>
              </th>}
              <td className="p-2 font-medium">{allocationIndex > 0 ? `${t('Y', 'AND')} · ` : ''}{prizeName}</td>
              {withSubstock && <td className="p-2">
                <input aria-label={`${t('Substock', 'Sub-stock')} ${prizeName}`} inputMode="numeric"
                  className={`${field} w-24 tabular-nums`} value={stock[allocation.prizeId] ?? ''}
                  onChange={event => onStockChange(allocation.prizeId, event.target.value)} />
              </td>}
              <td className="p-2">
                <input type="number" min={1} max={10} aria-label={`${t('Cantidad de', 'Quantity of')} ${prizeName} · ${key}`}
                  className={`${field} w-20 tabular-nums`}
                  value={Number.isFinite(allocation.quantity) ? allocation.quantity : ''}
                  onChange={event => setGroup(group.allocations.map((entry, n) => n === allocationIndex
                    ? { ...entry, quantity: event.target.valueAsNumber } : entry))} />
              </td>
              <td className="w-10 p-2">
                <IconButton icon="remove" className="!h-8 !w-8" label={`${t('Quitar premio', 'Remove prize')} ${prizeName} · ${key}`}
                  onClick={() => setGroup(group.allocations.filter((_, n) => n !== allocationIndex))} />
              </td>
            </tr>
          })}
          <tr className={group.allocations.length ? '' : 'border-t border-current/10'}>
            {!group.allocations.length && <th scope="rowgroup" className="p-2 align-top">
              <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-textSub">
                {groupIndex > 0 ? `${t('O', 'OR')} · ` : ''}{t('Grupo', 'Group')} {groupIndex + 1}
                {rule.groups.length > 1 && <IconButton icon="delete" className="!h-8 !w-8"
                  label={`${t('Quitar grupo', 'Remove group')} ${key}`}
                  onClick={() => update(index, { ...rule, groups: rule.groups.filter((_, i) => i !== groupIndex) })} />}
              </span>
            </th>}
            <td colSpan={withSubstock ? 4 : 3} className="p-2">
              <div className="flex flex-wrap items-center gap-2">
                <select className={`${field} w-full sm:w-64`} aria-label={`${t('Añadir premio al grupo', 'Add prize to group')} ${key}`}
                  value="" disabled={group.allocations.length >= 8 || !options.length} onChange={event => {
                    const id = event.target.value
                    if (!id) return
                    if (onAddPrize) onAddPrize(index, groupIndex, id)
                    else setGroup([...group.allocations, { prizeId: id, quantity: 1 }])
                  }}>
                  <option value="">{group.allocations.length ? `${t('Y', 'AND')} · ` : ''}{t('Seleccionar premio…', 'Select prize…')}</option>
                  {options.map(prize => <option key={prize.id} value={prize.id}>{prize.name}</option>)}
                </select>
                {!group.allocations.length && <span className="text-sm text-textSub">{t('Selecciona al menos un premio.', 'Select at least one prize.')}</span>}
              </div>
            </td>
          </tr>
        </Fragment>
      })}</tbody>
    </table>
    <div className="flex flex-wrap items-center gap-3">
      <IconButton icon="group" label={t('O añadir grupo', 'OR add group')} disabled={rule.groups.length >= 8}
        onClick={() => update(index, { ...rule, groups: [...rule.groups, { allocations: [] }] })} />
      <p className="min-w-0 flex-1 text-xs text-textSub">{t(
        'Sale un grupo al azar, con la misma probabilidad. Se entregan sus premios disponibles; los grupos agotados no participan.',
        'One group is chosen at random with equal probability. Its available prizes are awarded; exhausted groups are excluded.',
      )}</p>
    </div>
  </section>

  const firstFinalTopIndex = rules.findIndex(rule => rule.condition === 'top_final')
  const autoCloseFields = autoClose && <div className="mt-2 space-y-2 border-t border-current/10 pt-2 text-xs">
    <label className="flex items-center gap-2 font-semibold">
      <input type="checkbox" checked={autoClose.duration !== null}
        onChange={event => autoClose.onChange(event.target.checked ? { hours: 1, minutes: 0 } : null)} />
      {t('Cerrar automáticamente', 'Close automatically')}
    </label>
    {autoClose.duration && <div className="flex flex-wrap gap-2">
      {(['hours', 'minutes'] as const).map(unit => <label key={unit} className="flex items-center gap-1">
        {unit === 'hours' ? t('Horas', 'Hours') : t('Minutos', 'Minutes')}
        <input type="number" min={0} max={unit === 'minutes' ? 59 : undefined} step={1} className={`${field} w-16`}
          value={Number.isFinite(autoClose.duration?.[unit]) ? autoClose.duration?.[unit] : ''}
          onChange={event => {
            if (autoClose.duration) autoClose.onChange({ ...autoClose.duration, [unit]: event.target.valueAsNumber })
          }} />
      </label>)}
    </div>}
    <p className="text-textSub">{t(
      'Un contador para todo el juego. Empieza al guardar y no se reinicia si la duración no cambia.',
      'One timer for the entire game. It starts when you save and does not reset if the duration is unchanged.',
    )}</p>
    {autoClose.savedAt !== undefined && <p className="text-textSub">
      {autoClose.duration ? <>{t('Cierre guardado:', 'Saved closing time:')}{' '}
        <time dateTime={new Date(autoClose.savedAt * 1000).toISOString()}>{new Date(autoClose.savedAt * 1000).toLocaleString()}</time></>
        : t('El cierre automático se cancelará al guardar.', 'The automatic close will be cancelled when you save.')}
    </p>}
  </div>

  return <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-2 md:items-center">
      <div className="flex items-center gap-2">
        <IconButton icon="add" label={t('Añadir regla', 'Add rule')} disabled={rules.length >= 8 || !available.length} onClick={addRule} />
        <p className="text-xs text-textSub">{t(
          'Cada condición admite un premio por participante. Solo se muestran las condiciones compatibles con este juego.',
          'Each condition supports one prize per participant. Only conditions supported by this game are shown.',
        )}</p>
      </div>
      {headerAside}
    </div>
    {!!rules.length && <div className="overflow-x-auto">
      <table className="admin-table w-full text-left text-sm" aria-label={t('Condiciones', 'Conditions')}>
        <thead><tr>
          <th scope="col" className="whitespace-nowrap p-2"><span className="sr-only">{t('Selección', 'Selection')}</span></th>
          {[t('Condición', 'Condition'), t('Parámetros', 'Parameters'), t('Premios', 'Prizes'), '']
            .map((heading, i) => <th key={i} scope="col" className="whitespace-nowrap p-2">{heading}</th>)}
        </tr></thead>
        <tbody>{rules.map((rule, index) => {
          const isSelected = selected === index
          return <Fragment key={index}>
            <tr onClick={event => { if (!interactive(event)) toggle(index) }}
              className={`cursor-pointer border-t border-current/10 ${isSelected ? 'bg-primary/5' : ''}`}>
              <td className="w-10 p-2">
                <input type="radio" name="reward-rule-selection" checked={isSelected} className="h-4 w-4 accent-primary"
                  aria-label={`${t('Seleccionar regla', 'Select rule')} ${index + 1}`}
                  onClick={event => { event.stopPropagation(); toggle(index) }} onChange={() => undefined} />
              </td>
              <td className="p-2">
                <select aria-label={`${t('Condición', 'Condition')} ${index + 1}`} className={`${field} w-full min-w-[12rem]`}
                  value={rule.condition} onChange={event => {
                    const condition = event.target.value as StackPrizeCondition
                    setSelected(index)
                    update(index, { ...rule, condition, topX: condition.startsWith('top_') ? 10 : undefined,
                      scoreOperator: condition === 'score' ? '>=' : undefined, scoreValue: undefined, scoreMaxValue: undefined })
                  }}>
                  {conditions.filter(condition => condition !== 'raffle' || raffles || rule.condition === 'raffle')
                    .map(condition => <option key={condition} value={condition}>{label(condition)}</option>)}
                </select>
              </td>
              <td className="p-2">
                <div className="flex flex-wrap items-center gap-2">
                  {rule.condition.startsWith('top_') && <input type="number" min={1} max={100} aria-label={`Top ${index + 1}`}
                    placeholder="Top" className={`${field} w-20`} value={Number.isFinite(rule.topX) ? rule.topX : ''}
                    onChange={event => update(index, { ...rule, topX: event.target.valueAsNumber })} />}
                  {rule.condition === 'score' && <>
                    <select aria-label={`${t('Operador de puntuación', 'Score operator')} ${index + 1}`} className={`${field} w-24`}
                      value={rule.scoreOperator ?? '>='} onChange={event => update(index, { ...rule,
                        scoreOperator: event.target.value as StackPrizeScoreOperator,
                        scoreMaxValue: event.target.value === 'between' ? rule.scoreMaxValue : undefined })}>
                      {operators.map(operator => <option key={operator} value={operator}>{operator === 'between' ? t('entre', 'between') : operator}</option>)}
                    </select>
                    <input type="number" min={0} step={1} aria-label={`${t('Puntuación mínima', 'Score value')} ${index + 1}`}
                      className={`${field} w-24`} value={Number.isSafeInteger(rule.scoreValue) ? rule.scoreValue : ''}
                      onChange={event => update(index, { ...rule, scoreValue: event.target.valueAsNumber })} />
                    {rule.scoreOperator === 'between' && <input type="number" min={0} step={1}
                      aria-label={`${t('Puntuación máxima', 'Score maximum')} ${index + 1}`}
                      className={`${field} w-24`} value={Number.isSafeInteger(rule.scoreMaxValue) ? rule.scoreMaxValue : ''}
                      onChange={event => update(index, { ...rule, scoreMaxValue: event.target.valueAsNumber })} />}
                  </>}
                  {!rule.condition.startsWith('top_') && rule.condition !== 'score' && <span className="text-textSub">—</span>}
                </div>
                {index === firstFinalTopIndex && autoCloseFields}
              </td>
              <td className="p-2 text-textSub">{summary(rule)}</td>
              <td className="w-10 p-2">
                <IconButton icon="delete" className="!h-8 !w-8" label={`${t('Quitar regla', 'Remove rule')} ${index + 1}`}
                  onClick={() => removeRule(index)} />
              </td>
            </tr>
            {isSelected && <tr className="bg-primary/5">
              <td colSpan={5} className="px-3 pb-3">{detail(rule, index)}</td>
            </tr>}
          </Fragment>
        })}</tbody>
      </table>
    </div>}
    {firstFinalTopIndex === -1 && autoClose?.savedAt !== undefined && <p className="text-sm text-textSub">
      {t('El cierre automático se cancelará al guardar porque ya no hay premios de top final.',
        'The automatic close will be cancelled when you save because there are no final ranking prizes.')}
    </p>}
  </div>
}