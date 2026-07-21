import { describe, expect, it } from 'vitest'
import { mapCognitoError } from './cognitoClient'

describe('mapCognitoError', () => {
  it('maps known Cognito codes to Spanish copy', () => {
    expect(mapCognitoError('NotAuthorizedException', 'x')).toBe('Email o contraseña incorrectos')
    expect(mapCognitoError('UserNotConfirmedException', 'x')).toBe(
      'Confirma tu email antes de iniciar sesión',
    )
    expect(mapCognitoError('CodeMismatchException', 'x')).toBe('Código incorrecto')
  })

  it('falls back to message for unknown codes', () => {
    expect(mapCognitoError('WeirdException', 'algo falló')).toBe('algo falló')
    expect(mapCognitoError(undefined, '')).toBe('Error de autenticación')
  })
})
