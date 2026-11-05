import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import AccountInformation from './AccountInformation'

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear() })

it('shows the former home account fields with live validity and localized plan', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T12:00:00Z'))
  render(<OperatorLanguageProvider><AccountInformation user={{
    id: 'u', email: 'ana@example.com', plan: 'event',
    activeUntil: '2026-11-04T13:00:00Z', createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-11-03T11:00:00Z',
  }} /></OperatorLanguageProvider>)
  expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  expect(screen.getByText('Evento 24h')).toBeInTheDocument()
  expect(screen.getByText('Activo hasta')).toBeInTheDocument()
  expect(screen.getByText('1h 0m 0s')).toBeInTheDocument()
  expect(screen.getByText('Cuenta creada')).toBeInTheDocument()
  expect(screen.getByText('Última actualización')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Activar 24h' })).not.toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.getByText('59m 59s')).toBeInTheDocument()
})

it('shows unavailable dates and expired validity explicitly', () => {
  render(<OperatorLanguageProvider><AccountInformation user={{
    id: 'u', plan: 'enterprise', activeUntil: '2020-01-01T00:00:00Z', createdAt: 'invalid',
  }} showEmail={false} /></OperatorLanguageProvider>)
  expect(screen.getByText('Enterprise')).toBeInTheDocument()
  expect(screen.getByText('Expirado')).toBeInTheDocument()
  expect(screen.getByText('No disponible')).toBeInTheDocument()
  expect(screen.queryByText('Email')).not.toBeInTheDocument()
})
