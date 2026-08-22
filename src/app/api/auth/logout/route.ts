import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/authRequest'

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 })

  // Effacer le cookie d'authentification
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })

  return response
}


