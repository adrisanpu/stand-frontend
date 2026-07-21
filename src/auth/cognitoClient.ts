/**
 * Cognito Identity Provider calls for the SPA (public app client).
 * ponytail: USER_PASSWORD_AUTH sends the password over TLS to Cognito IdP;
 * switch to USER_SRP_AUTH (+ SRP helper) if a stricter client-side threat model is required.
 */

const REGION = 'us-east-1'
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`

const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID

export type CognitoTokens = {
  accessToken: string
  idToken: string
  expiresIn: number
}

export type SignInResult =
  | { kind: 'tokens'; tokens: CognitoTokens }
  | { kind: 'newPasswordRequired'; session: string; email: string }

export class CognitoError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'CognitoError'
  }
}

/** Map Cognito `__type` / message to short Spanish copy for the login UI. */
export function mapCognitoError(code: string | undefined, message: string): string {
  switch (code) {
    case 'NotAuthorizedException':
      return 'Email o contraseña incorrectos'
    case 'UserNotConfirmedException':
      return 'Confirma tu email antes de iniciar sesión'
    case 'UsernameExistsException':
      return 'Ya existe una cuenta con ese email'
    case 'InvalidPasswordException':
      return 'La contraseña no cumple los requisitos'
    case 'CodeMismatchException':
      return 'Código incorrecto'
    case 'ExpiredCodeException':
      return 'El código ha caducado; solicita uno nuevo'
    case 'UserNotFoundException':
      return 'No encontramos una cuenta con ese email'
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Demasiados intentos; espera un momento'
    case 'InvalidParameterException':
      return message.includes('password') ? 'Contraseña no válida' : 'Datos no válidos'
    default:
      return message || 'Error de autenticación'
  }
}

type CognitoJson = Record<string, unknown> & {
  __type?: string
  message?: string
  AuthenticationResult?: {
    AccessToken?: string
    IdToken?: string
    ExpiresIn?: number
  }
  ChallengeName?: string
  Session?: string
}

async function cognitoCall(target: string, body: Record<string, unknown>): Promise<CognitoJson> {
  if (!CLIENT_ID || !USER_POOL_ID) {
    throw new CognitoError('Faltan VITE_COGNITO_CLIENT_ID o VITE_COGNITO_USER_POOL_ID')
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as CognitoJson
  if (!res.ok || data.__type) {
    const type = data.__type?.split('#').pop()
    throw new CognitoError(mapCognitoError(type, data.message || ''), type)
  }
  return data
}

function tokensFromAuthResult(result: NonNullable<CognitoJson['AuthenticationResult']>): CognitoTokens {
  const accessToken = result.AccessToken
  const idToken = result.IdToken
  const expiresIn = result.ExpiresIn
  if (!accessToken || !idToken || !expiresIn) {
    throw new CognitoError('Tokens no recibidos')
  }
  return { accessToken, idToken, expiresIn }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const data = await cognitoCall('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  })

  if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED' && data.Session) {
    return { kind: 'newPasswordRequired', session: data.Session, email }
  }

  if (!data.AuthenticationResult) {
    throw new CognitoError('Respuesta de login inesperada', data.ChallengeName)
  }
  return { kind: 'tokens', tokens: tokensFromAuthResult(data.AuthenticationResult) }
}

export async function respondNewPassword(
  email: string,
  session: string,
  newPassword: string,
): Promise<CognitoTokens> {
  const data = await cognitoCall('RespondToAuthChallenge', {
    ClientId: CLIENT_ID,
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: session,
    ChallengeResponses: {
      USERNAME: email,
      NEW_PASSWORD: newPassword,
    },
  })
  if (!data.AuthenticationResult) {
    throw new CognitoError('No se pudo establecer la nueva contraseña')
  }
  return tokensFromAuthResult(data.AuthenticationResult)
}

export async function signUp(email: string, password: string): Promise<void> {
  await cognitoCall('SignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  })
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognitoCall('ConfirmSignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  })
}

export async function forgotPassword(email: string): Promise<void> {
  await cognitoCall('ForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
  })
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await cognitoCall('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  })
}
