import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/authServer'
import { allowAuthAttempt } from '@/lib/authRateLimit'

const COOKIE_NAME = 'yams_auth_token'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Par défaut: secure = true en production, false en dev.
// Surchargable via AUTH_COOKIE_SECURE pour les environnements HTTP derrière Docker/proxy.
const isProd = process.env.NODE_ENV === 'production'
const COOKIE_SECURE =
  process.env.AUTH_COOKIE_SECURE === 'true'
    ? true
    : process.env.AUTH_COOKIE_SECURE === 'false'
      ? false
      : isProd

export async function POST(request: NextRequest) {
  try {
    if (!await allowAuthAttempt(request, 'login')) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie plus tard.' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password || !EMAIL.test(email) || password.length > 1024) {
      return NextResponse.json(
        { error: 'Email et mot de passe sont requis.' },
        { status: 400 }
      )
    }

    const { user, token, expiresIn } = await authenticateUser(email, password)

    const response = NextResponse.json(
      {
        user,
      },
      { status: 200 }
    )

    const expires = new Date(Date.now() + expiresIn * 1000)

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      expires,
    })

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur lors de la connexion.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}


