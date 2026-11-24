import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { OperatorLanguageProvider, OperatorLanguageSelector, useOperatorLanguage } from './operatorLanguage'
import { ParticipantLanguageProvider, ParticipantLanguageSelector, useParticipantLanguage } from '../participant/participantLanguage'

afterEach(cleanup)

function OperatorText() {
  const { t } = useOperatorLanguage()
  return <p>{t('Jugadores', 'Players')}</p>
}

function ParticipantText() {
  const { t } = useParticipantLanguage()
  return <p>{t('Validar pareja')}</p>
}

it('keeps operator and participant language choices independent', () => {
  render(
    <OperatorLanguageProvider>
      <div data-testid="operator">
        <OperatorLanguageSelector />
        <OperatorText />
      </div>
      <ParticipantLanguageProvider>
        <div data-testid="participant">
          <ParticipantLanguageSelector />
          <ParticipantText />
        </div>
      </ParticipantLanguageProvider>
    </OperatorLanguageProvider>
  )
  const operatorSelector = within(screen.getByTestId('operator')).getByRole('combobox', { name: 'Idioma' })
  const participantSelector = within(screen.getByTestId('participant')).getByRole('combobox', { name: 'Idioma' })
  fireEvent.change(operatorSelector, { target: { value: 'en' } })
  expect(screen.getByText('Players')).toBeInTheDocument()
  expect(screen.getByText('Validar pareja')).toBeInTheDocument()
  expect(participantSelector).toHaveValue('es')
  fireEvent.change(participantSelector, { target: { value: 'en' } })
  fireEvent.change(operatorSelector, { target: { value: 'es' } })
  expect(screen.getByText('Jugadores')).toBeInTheDocument()
  expect(screen.getByText('Validate pair')).toBeInTheDocument()
})
