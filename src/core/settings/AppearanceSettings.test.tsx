import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fetchUserMedia, saveAppearance } from '../../api/userMedia'
import { STORAGE_KEY_COLORS } from '../storageKeys'
import AppearanceSettings from './AppearanceSettings'

vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event' }) }))
vi.mock('../../api/userMedia', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/userMedia')>(),
  fetchUserMedia: vi.fn(),
  saveAppearance: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchUserMedia).mockResolvedValue({
    ok: true,
    appearance: { colors: { primary: '#ff0000', accent: '#00ff00' }, themeMode: 'light' },
    logo: { items: [], selectedId: null, selected: null },
    avatar: {
      items: [],
      selectedByState: { idle: null, win: null, lose: null },
      selected: { idle: null, win: null, lose: null },
    },
  })
})
afterEach(cleanup)

it.each(['Guardar Cambios', 'Restaurar por Defecto'])('reports failure for %s before changing local settings', async (button) => {
  const previous = localStorage.getItem(STORAGE_KEY_COLORS)
  vi.mocked(saveAppearance).mockRejectedValueOnce(new Error('Servidor no disponible'))
  render(<AppearanceSettings onBack={vi.fn()} onCloseMenu={vi.fn()} />)
  expect(await screen.findAllByDisplayValue('#ff0000')).toHaveLength(2)
  expect(screen.getAllByDisplayValue('#00ff00')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: button }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Servidor no disponible')
  expect(saveAppearance).toHaveBeenCalledWith(button === 'Guardar Cambios'
    ? { colors: { primary: '#ff0000', accent: '#00ff00' }, themeMode: 'light' }
    : { colors: null, themeMode: 'dark' })
  expect(localStorage.getItem(STORAGE_KEY_COLORS)).toBe(previous)
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled()
})
