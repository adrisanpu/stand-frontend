import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import PrizePresentation, { PrizeImage } from './PrizePresentation'

afterEach(cleanup)

it('contains the complete prize image and preserves the custom name', () => {
  render(<PrizePresentation prize={{ name: 'Mi premio', limit: null, imageUrl: '/prize.png' }} label="Premio por pareja" />)
  const image = screen.getByRole('img', { name: 'Mi premio' })
  expect(image).toHaveClass('object-contain')
  expect(image).toHaveAttribute('src', '/prize.png')
  expect(screen.getByText('Mi premio')).toBeInTheDocument()
  expect(screen.getByText('Premio por pareja')).toBeInTheDocument()
})

it('keeps text-only prizes without an empty image placeholder', () => {
  render(<PrizePresentation prize={{ name: 'Entrada', limit: 10 }} />)
  expect(screen.getByText('Entrada')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('does not render unconfigured prizes or images', () => {
  const { container } = render(<><PrizePresentation /><PrizeImage /></>)
  expect(container).toBeEmptyDOMElement()
})
