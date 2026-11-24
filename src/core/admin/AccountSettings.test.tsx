import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { saveAccountProfile, uploadProfilePhoto } from '../../api/accountProfile'
import type { BackendUser, User } from '../../auth/useCurrentUser'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import AccountSettings from './AccountSettings'
import ProfileAvatar from '../widgets/ProfileAvatar'
import { api } from '../../api/api'

vi.mock('../../api/api', () => ({ api: { post: vi.fn() } }))

vi.mock('../../api/accountProfile', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/accountProfile')>(),
  saveAccountProfile: vi.fn(), uploadProfilePhoto: vi.fn(),
}))
const user: User = {
  id: 'user-1', name: 'Ana', email: 'ana@example.com', plan: 'free',
  profilePhotoKey: 'old-key', profilePicUrl: 'https://example.com/old.jpg',
}
const updated: BackendUser = {
  userId: 'user-1', name: 'Ana Nueva', email: user.email, plan: 'FREE',
  profilePhotoKey: 'new-key', profilePicUrl: 'https://example.com/new.jpg',
}
function mount() {
  function Harness() {
    const [current, setCurrent] = useState(user)
    return <OperatorLanguageProvider>
      <ProfileAvatar profilePicUrl={current.profilePicUrl} username={current.name} />
      <AccountSettings user={current} onSaved={profile => setCurrent(previous => ({
        ...previous, name: profile.name, profilePhotoKey: profile.profilePhotoKey, profilePicUrl: profile.profilePicUrl,
      }))} />
    </OperatorLanguageProvider>
  }
  return render(<Harness />)
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview')
    static revokeObjectURL = vi.fn()
  })
  vi.mocked(saveAccountProfile).mockResolvedValue(updated)
  vi.mocked(uploadProfilePhoto).mockResolvedValue('new-key')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('uploads a photo, saves the account and updates the shared identity', async () => {
  mount()
  const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: ' Ana Nueva ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Cuenta actualizada')
  expect(uploadProfilePhoto).toHaveBeenCalledWith(file)
  expect(saveAccountProfile).toHaveBeenCalledWith('Ana Nueva', 'new-key')
  expect(document.querySelectorAll('img[src="https://example.com/new.jpg"]')).toHaveLength(2)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

it('shows account information directly on the page without an outer card', () => {
  mount()
  expect(screen.getByRole('region', { name: 'Información de la cuenta' })).toBeInTheDocument()
  expect(screen.getByText('Gratis')).toBeInTheDocument()
  expect(screen.getByText('Cuenta creada')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Activar 24h' })).toBeInTheDocument()
  const form = screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')!
  expect(form.className).not.toContain('bg-surface')
  expect(form.className).not.toContain('border')
})

it('reports checkout failures and allows retry without submitting profile edits', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Offline'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Activar 24h' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Error al iniciar el pago')
  expect(api.post).toHaveBeenCalledWith('/v1/billing/checkout', {})
  expect(screen.getByRole('button', { name: 'Activar 24h' })).toBeEnabled()
  expect(saveAccountProfile).not.toHaveBeenCalled()
})

it('removes the photo only when saving', async () => {
  vi.mocked(saveAccountProfile).mockResolvedValue({ ...updated, profilePhotoKey: null, profilePicUrl: null })
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }))
  expect(saveAccountProfile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByRole('status')
  expect(saveAccountProfile).toHaveBeenCalledWith('Ana', null)
  expect(uploadProfilePhoto).not.toHaveBeenCalled()
  expect(document.querySelector('img')).not.toBeInTheDocument()
})

it.each([
  new File(['x'], 'bad.svg', { type: 'image/svg+xml' }),
  new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
  new File([], 'empty.png', { type: 'image/png' }),
])('rejects invalid photos before uploading', file => {
  mount()
  fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })
  expect(screen.getByRole('alert')).toHaveTextContent('hasta 5 MB')
  expect(uploadProfilePhoto).not.toHaveBeenCalled()
})

it('retains edits and shows no success when upload fails, allowing retry', async () => {
  vi.mocked(uploadProfilePhoto).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue('new-key')
  mount()
  fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Ana Nueva' } })
  fireEvent.change(screen.getByLabelText('Foto de perfil'), {
    target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Ana Nueva')
  expect(saveAccountProfile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByRole('status')
})

it('retains the current avatar when saving fails', async () => {
  vi.mocked(saveAccountProfile).mockRejectedValue(new Error('Offline'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByRole('alert')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
  expect(document.querySelector('img[src="https://example.com/old.jpg"]')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
