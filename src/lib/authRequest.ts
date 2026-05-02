import { NextRequest, NextResponse } from 'next/server'
import { AuthUser, verifyJwtToken } from './authServer'

export const AUTH_COOKIE_NAME = 'yams_auth_token'

export type AuthRequestResult =
  | { user: AuthUser; response?: never }
  | { user?: never; response: NextResponse }

export function getAuthUserFromRequest(request: NextRequest): AuthUser | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  return token ? verifyJwtToken(token) : null
}

export function requireAuth(request: NextRequest): AuthRequestResult {
  const user = getAuthUserFromRequest(request)

  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      ),
    }
  }

  return { user }
}
