import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SaveButton from './SaveButton'
import IconButton from './IconButton'

afterEach(cleanup)

it('uses the same save styling for text and icon actions without changing behavior', () => {
  const save = vi.fn()
  render(<>
    <SaveButton type="submit" onClick={save}>Guardar cambios</SaveButton>
    <SaveButton iconOnly disabled>Guardar condiciones</SaveButton>
  </>)
  const text = screen.getByRole('button', { name: 'Guardar cambios' })
  const icon = screen.getByRole('button', { name: 'Guardar condiciones' })
  expect(text.className).toBe(icon.className)
  expect(text).toHaveAttribute('type', 'submit')
  fireEvent.click(text)
  expect(save).toHaveBeenCalledOnce()
  expect(icon.textContent).toBe('')
  expect(icon).toBeDisabled()
  expect(icon).toHaveAttribute('title', 'Guardar condiciones')
  expect(icon.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

it('renders labeled icon-only condition actions with tooltips', () => {
  const add = vi.fn()
  render(<IconButton icon="add" label="Añadir regla" onClick={add} />)
  const button = screen.getByRole('button', { name: 'Añadir regla' })
  expect(button).toHaveAttribute('title', 'Añadir regla')
  expect(button.textContent).toBe('')
  fireEvent.click(button)
  expect(add).toHaveBeenCalledOnce()
})

it.each(['delete', 'remove'] as const)('uses the red border and background for %s actions', icon => {
  render(<IconButton icon={icon} label="Quitar" />)
  const button = screen.getByRole('button', { name: 'Quitar' })
  expect(button).toHaveAttribute('data-tone', 'danger')
  expect(button).toHaveClass('border-red-500/40', 'bg-red-500/20', 'text-red-500')
})
