import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import PrizeSticker from './PrizeSticker'

afterEach(cleanup)

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
