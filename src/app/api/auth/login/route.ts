import { NextRequest, NextResponse } from 'next/server'

import { allowAuthAttempt } from '@/lib/authRateLimit'
import { authenticateUser } from '@/lib/authServer'

const COOKIE_NAME = 'yams_auth_token'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isProd = process.env.NODE_ENV === 'production'
const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === 'true'
  ? true
  : process.env.AUTH_COOKIE_SECURE === 'false'
    ? false
    : isProd

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }
    const rateLimit = await allowAuthAttempt(request, 'login', email)
    if (rateLimit === 'limited') {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie plus tard.' }, { status: 429 })
    }
    if (rateLimit === 'unavailable') {
      return NextResponse.json({ error: 'Le limiteur de connexion est indisponible. Vérifie la migration 018.' }, { status: 503 })
    }
    if (!email || !password || !EMAIL.test(email) || password.length > 1024) {
      return NextResponse.json({ error: 'Email et mot de passe sont requis.' }, { status: 400 })
    }

    const { user, token, expiresIn } = await authenticateUser(email, password)
    const response = NextResponse.json({ user }, { status: 200 })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      expires: new Date(Date.now() + expiresIn * 1000),
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la connexion.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
