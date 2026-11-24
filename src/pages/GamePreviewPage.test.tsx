import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GamePreviewPage from './GamePreviewPage'

vi.mock('../core/admin/GamePlayPreview', () => ({
  default: ({ gameType, settings }: { gameType: string; settings?: Record<string, unknown> }) => (
    <div data-testid="game-preview" data-game-type={gameType} data-settings={settings === undefined ? 'static' : 'interactive'} />
  ),
}))

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(['RULET4', 'T1MER', 'STACK', 'L3TRAS', 'INFOCARDS', 'EMPAREJA2', 'CUPIDO', 'SEMAFORO'])(
  'makes the %s preview available on a public route',
  (gameType) => {
    render(
      <MemoryRouter initialEntries={[`/preview/${gameType}?lang=en`]}>
        <Routes><Route path="/preview/:gameType" element={<GamePreviewPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Sample game · Your actions are not saved and no real prizes are awarded.')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-preview')).toHaveAttribute('data-game-type', gameType)
    expect(screen.getByTestId('game-preview')).toHaveAttribute('data-settings', gameType === 'CUPIDO' ? 'static' : 'interactive')
  },
)

it('shows a clear message for unsupported demo types', () => {
  render(
    <MemoryRouter initialEntries={['/preview/UNKNOWN']}>
      <Routes><Route path="/preview/:gameType" element={<GamePreviewPage />} /></Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent('La vista previa de este juego no está disponible.')
  expect(screen.queryByTestId('game-preview')).not.toBeInTheDocument()
})
