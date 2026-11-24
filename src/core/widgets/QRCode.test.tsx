import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import QRCode from './QRCode'

afterEach(cleanup)

const svgOf = () => decodeURIComponent(screen.getByRole('img', { name: 'QR' }).getAttribute('src')!.split(',')[1])

it('renders themed QR locally as a white plate with transparent (cut-out) modules', () => {
  render(<QRCode data="https://play.test" alt="QR" themed />)
  expect(screen.getByRole('img', { name: 'QR' }).getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  const svg = svgOf()
  expect(svg).toContain('fill="#FFFFFF"')
  expect(svg).toContain('fill-rule="evenodd"')
  expect(svg).toMatch(/d="M0 0h(\d+)v\1H0z/)
})

it('keeps the remote black-on-white QR when not themed', () => {
  render(<QRCode data="https://play.test" alt="QR" />)
  const src = new URL(screen.getByRole('img', { name: 'QR' }).getAttribute('src')!)
  expect(src.hostname).toBe('api.qrserver.com')
  expect(src.searchParams.get('data')).toBe('https://play.test')
})
