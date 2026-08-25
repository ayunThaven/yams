import { NextRequest, NextResponse } from 'next/server'
import { allowAuthAttempt } from '@/lib/authRateLimit'
import {
  BACKOFFICE_CHALLENGE_COOKIE,
  authenticateBackofficePassword,
  backofficeCookieOptions,
  createChallengeToken,
  requireBackofficeGate,
  hiddenNotFound,
  verifySameOrigin,
} from '@/lib/backofficeAuth'

export async function POST(request: NextRequest) {
  if (!(await requireBackofficeGate(request))) return hiddenNotFound()
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string }
  const limit = await allowAuthAttempt(request, 'backoffice-login', body.email)
  if (limit !== 'allowed') return NextResponse.json({ error: 'Connexion temporairement indisponible.' }, { status: limit === 'limited' ? 429 : 503 })
  if (!body.email || !body.password) return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 400 })
  const user = await authenticateBackofficePassword(body.email, body.password)
  if (!user) return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 400 })
  const response = NextResponse.json({ mfaRequired: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BACKOFFICE_CHALLENGE_COOKIE, createChallengeToken(user.id), backofficeCookieOptions(300))
  return response
}

