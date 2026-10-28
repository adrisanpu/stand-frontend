import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import PrizeSticker from './PrizeSticker'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it.each([true, false])('shows large contained artwork in a theme-colored circle (compact=%s)', (compact) => {
  render(<PrizeSticker prize={{ name: 'Copa', limit: 5, imageUrl: '/cup.png' }} label="Copa" current={2} max={5} compact={compact} />)
  const image = screen.getByRole('img', { name: 'Copa' })
  expect(image).toHaveClass('object-contain', 'h-full', 'w-full')
  expect(image.parentElement).toHaveClass('rounded-full', 'bg-primary', 'h-full', 'aspect-square')
  const label = screen.getByText('PREMIO: Copa')
  expect(label.nextElementSibling).toHaveTextContent('2/5')
  expect(label.parentElement?.parentElement).toHaveClass('self-end', compact ? 'h-16' : 'h-20', compact ? '-mb-8' : '-mb-10', 'z-10', 'max-w-full', 'border-2', 'border-primary')
  expect(label.parentElement?.parentElement).toHaveClass(
    'bg-[var(--color-background,#0B0A12)]',
    'bg-[linear-gradient(var(--color-surface),var(--color-surface))]',
  )
})

const items = [
  { id: 'pizza', name: 'Pizza', limit: null, imageUrl: '/pizza.png', heading: '' },
  { id: 'drink', name: 'Bebida', limit: null, heading: '' },
]
it('slides prize content in one stable sticker and supports pause and manual next', () => {
  vi.useFakeTimers()
  render(<PrizeSticker items={items} current={0} />)
  const sticker = screen.getByText('Pizza').parentElement!.parentElement
  expect(screen.queryByText(/PREMIO:/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pausar premios' }).parentElement).toHaveClass('sr-only')
  expect(screen.getByRole('img', { name: 'Pizza' })).toHaveAttribute('src', '/pizza.png')
  act(() => { vi.advanceTimersByTime(4000) })
  expect(screen.getByText('Bebida').parentElement!.parentElement).toBe(sticker)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pausar premios' }))
  act(() => { vi.advanceTimersByTime(8000) })
  expect(screen.getByText('Bebida')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente premio' }))
  expect(screen.getByText('Pizza')).toBeInTheDocument()
})
it('does not rotate automatically with reduced motion and permits manual browsing', () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  render(<PrizeSticker items={items} current={0} />)
  act(() => { vi.advanceTimersByTime(12000) })
  expect(screen.getByText('Pizza')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente premio' }))
  expect(screen.getByText('Bebida')).toBeInTheDocument()
})
it('omits empty carousels and controls for a single prize', () => {
  const { rerender, container } = render(<PrizeSticker items={[]} current={0} />)
  expect(container).toBeEmptyDOMElement()
  rerender(<PrizeSticker items={[items[0]]} current={0} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('wraps long names within two lines and exposes the full name as a tooltip', () => {
  const name = 'Una experiencia exclusiva para dos personas con estancia y desayuno'
  render(<PrizeSticker label={name} current={0} max={0} />)
  expect(screen.getByText(`PREMIO: ${name}`)).toHaveClass('break-words', '[overflow-wrap:anywhere]', 'line-clamp-2')
  expect(screen.getByText(`PREMIO: ${name}`)).toHaveAttribute('title', name)
  expect(screen.getByText('0/0')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('hides unlimited counters and empty prizes, without synthesizing artwork', () => {
  const { rerender, container } = render(<PrizeSticker label="Entrada" current={3} />)
  expect(screen.getByText('PREMIO: Entrada')).toBeInTheDocument()
  expect(screen.queryByText(/3\//)).not.toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  rerender(<PrizeSticker current={3} />)
  expect(container).toBeEmptyDOMElement()
})

it('supports image-only prizes and updates the language without translating the custom name', () => {
  const { rerender } = render(<PrizeSticker prize={{ name: '', limit: 4, imageUrl: '/cup.png' }} current={1} max={4} />)
  expect(screen.getByAltText('')).toHaveAttribute('src', '/cup.png')
  expect(screen.getByText('1/4')).toBeInTheDocument()
  rerender(
    <OperatorLanguageProvider>
      <OperatorLanguageSelector />
      <PrizeSticker label="Entrada VIP" current={1} max={4} />
    </OperatorLanguageProvider>,
  )
  fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
  expect(screen.getByText('PRIZE: Entrada VIP')).toBeInTheDocument()
})
