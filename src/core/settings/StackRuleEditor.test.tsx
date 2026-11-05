import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { StackPrizeRule } from '../../api/stackPrizes'
import StackRuleEditor, { invalidStackRules } from './StackRuleEditor'

afterEach(cleanup)
const catalog = [
  { id: 'pizza', source: 'stand' as const, name: 'Pizza', stockTotal: 100 },
  { id: 'coffee', source: 'kivly' as const, name: 'Coffee', stockTotal: 30, rewardId: 'external', locationId: 'loc' },
]
const initial: StackPrizeRule[] = [
  { id: 'original', condition: 'completed', groups: [{ allocations: [{ prizeId: 'pizza', quantity: 1 }] }] },
]
function Harness({ raffles = true }: { raffles?: boolean }) {
  const [rules, setRules] = useState(initial)
  return <>
    <StackRuleEditor rules={rules} catalog={catalog} raffles={raffles} onChange={setRules} />
    <button disabled={invalidStackRules(rules)}>Guardar condiciones</button>
    <output data-testid="rules">{JSON.stringify(rules)}</output>
  </>
}
const value = () => JSON.parse(screen.getByTestId('rules').textContent!) as StackPrizeRule[]

it('edits OR groups, AND prizes and quantities while replacing only the edited rule identity', () => {
  render(<Harness />)
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '3' } })
  expect(value()[0].id).not.toBe('original')
  fireEvent.click(screen.getByRole('button', { name: 'O añadir grupo' }))
  for (const button of screen.getAllByRole('button').filter(button => button.querySelector('svg'))) {
    expect(button.textContent).toBe('')
    expect(button).toHaveAttribute('title', button.getAttribute('aria-label'))
  }
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.2'), { target: { value: 'coffee' } })
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.2'), { target: { value: 'pizza' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeEnabled()
  expect(value()[0].groups).toEqual([
    { allocations: [{ prizeId: 'pizza', quantity: 3 }] },
    { allocations: [{ prizeId: 'coffee', quantity: 1 }, { prizeId: 'pizza', quantity: 1 }] },
  ])
  expect(catalog[0].stockTotal).toBe(100)
  expect(screen.queryByLabelText(/Stock/)).not.toBeInTheDocument()
})

it('removes allocations only with the explicit remove control and validates empty groups', () => {
  render(<Harness />)
  fireEvent.click(screen.getByLabelText('Cantidad de Pizza · 1.1'))
  expect(value()[0].groups[0].allocations).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Quitar premio Pizza · 1.1' }))
  expect(screen.getByText('Selecciona al menos un premio.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
})

it('offers existing ranking conditions and validates inclusive score bounds', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(value()[0].id).toBe('original')
  fireEvent.change(screen.getByLabelText('Condición 2'), { target: { value: 'top_final' } })
  expect(screen.getByLabelText('Top 2')).toHaveValue(10)
  expect(screen.getAllByRole('option', { name: 'entre en el top al terminar su partida' })).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Quitar regla 2' }))
  fireEvent.change(screen.getByLabelText('Condición 1'), { target: { value: 'score' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Operador de puntuación 1'), { target: { value: 'between' } })
  fireEvent.change(screen.getByLabelText('Puntuación mínima 1'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('Puntuación máxima 1'), { target: { value: '20' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Puntuación máxima 1'), { target: { value: '9' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
})

it('does not offer manual raffles on a plan without raffles', () => {
  render(<Harness raffles={false} />)
  expect(screen.queryByRole('option', { name: 'gane un sorteo' })).not.toBeInTheDocument()
})
