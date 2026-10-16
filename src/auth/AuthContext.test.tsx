import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, beforeEach } from 'vitest'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

describe('AuthProvider session restoration', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('keeps a protected route available when a valid session is restored', async () => {
    sessionStorage.setItem('stand_tokens', JSON.stringify({
      accessToken: 'access-token',
      idToken: 'id-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }))

    render(
      <MemoryRouter initialEntries={['/private']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/private"
              element={<ProtectedRoute><p>Private content</p></ProtectedRoute>}
            />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText('Private content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
