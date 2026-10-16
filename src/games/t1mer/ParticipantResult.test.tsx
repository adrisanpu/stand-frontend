import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { savePlayerSession } from '../../core/participant/playerSession'
import T1merParticipantResult from './ParticipantResult'

afterEach(() => { cleanup(); sessionStorage.clear() })

describe('T1MER shared result presentation', () => {
  it('preserves existing labels, time, difference, identity and rank', () => {
    savePlayerSession('GAME1', 'token', { playerId: 1, displayName: '@rosa', validated: true })
    render(<T1merParticipantResult gameId="GAME1" time={10.125} difference={0.125} rank={2} />)
    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText('@rosa')).toBeInTheDocument()
    expect(screen.getByText('10.125 s')).toBeInTheDocument()
    expect(screen.getByText('0.125 s')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('Solo un intento. Mira el ranking en la pantalla del evento.')).toBeInTheDocument()
  })
})
