import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GamePlayPreview from './GamePlayPreview'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([
  ['L3TRAS', 'Añadir letra'],
  ['SEMAFORO', 'Validar pareja'],
  ['CUPIDO', 'Validar pareja'],
  ['INFOCARDS', 'Siguiente'],
])('previews %s without mounting an engine or requesting participant data', (gameType, button) => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { container } = render(<GamePlayPreview gameType={gameType} />)
  expect(screen.getByRole('button', { name: button })).toBeDisabled()
  if (gameType === 'CUPIDO') expect(screen.getByText('En desarrollo')).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  expect(container.querySelector('canvas,iframe,input')).toBeNull()
})
