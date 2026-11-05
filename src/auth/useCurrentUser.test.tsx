import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/api'
import { useCurrentUser, type BackendUser } from './useCurrentUser'

vi.mock('../api/api', () => ({ api: { get: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

it('loads persisted profile fields and updates shared state after saving', async () => {
  vi.mocked(api.get).mockResolvedValue({ user: {
    userId: 'user-1', plan: 'FREE', name: 'Ana', email: 'ana@example.com',
    profilePhotoKey: 'old-key', profilePicUrl: 'https://old',
  } })
  const { result } = renderHook(() => useCurrentUser(), { wrapper: MemoryRouter })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.user).toMatchObject({
    id: 'user-1', plan: 'free', name: 'Ana',
    profilePhotoKey: 'old-key', profilePicUrl: 'https://old',
  })
  const savedUser: BackendUser = {
    userId: 'user-1', plan: 'FREE', name: 'Ana Nueva',
    profilePhotoKey: 'new-key', profilePicUrl: 'https://new',
  }
  act(() => result.current.updateProfile(savedUser))
  expect(result.current.user).toMatchObject({
    email: 'ana@example.com', plan: 'free', name: 'Ana Nueva', profilePicUrl: 'https://new',
  })
  act(() => result.current.updateProfile({ name: 'Ana Nueva', profilePhotoKey: null, profilePicUrl: null }))
  expect(result.current.user?.profilePicUrl).toBeNull()
  expect(api.get).toHaveBeenCalledOnce()
})
