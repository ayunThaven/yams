import { NextRequest, NextResponse } from 'next/server'
import { isSameSiteOrigin } from '@/lib/requestOrigin'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowAuthAttempt } from '@/lib/authRateLimit'
import { getAuthUserFromRequest } from '@/lib/authRequest'
import { GUEST_COOKIE_NAME, GUEST_SESSION_SECONDS, guestCookieOptions, resolveGuestSession, signGuestToken, validateGuestNickname } from '@/lib/guestSession'
import { trackEvent } from '@/lib/analytics'
import { isGuestNicknameAvailable, RESERVED_NICKNAME_MESSAGE } from '@/lib/guestNickname'

function publicSession(session: { id: string; nickname: string; expires_at: string }) {
  return { guestSessionId: session.id, nickname: session.nickname, expiresAt: session.expires_at }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameSiteOrigin(request.headers.get('origin'), request.headers.get('host') || request.nextUrl.host)) return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 })
    if (getAuthUserFromRequest(request)) return NextResponse.json({ error: 'Vous êtes déjà connecté à un compte.' }, { status: 409 })
    const limit = await allowAuthAttempt(request, 'guest-session')
    if (limit !== 'allowed') return NextResponse.json({ error: limit === 'limited' ? 'Trop de tentatives. Réessayez plus tard.' : 'Service temporairement indisponible.' }, { status: limit === 'limited' ? 429 : 503 })
    const body = await request.json().catch(() => null)
    const nickname = validateGuestNickname(body?.nickname)
    if (!nickname) return NextResponse.json({ error: 'Choisissez un pseudo de 1 à 32 caractères, sans caractères de contrôle.' }, { status: 400 })
    const supabase = createAdminClient()
    if (!supabase) throw new Error('Base de données indisponible')
    const existing = await resolveGuestSession(supabase, request.cookies.get(GUEST_COOKIE_NAME)?.value)
    if (existing) return NextResponse.json({ session: publicSession(existing) }, { headers: { 'Cache-Control': 'no-store' } })
    if (!await isGuestNicknameAvailable(supabase, nickname)) return NextResponse.json({ error: RESERVED_NICKNAME_MESSAGE }, { status: 409 })
    const now = Date.now()
    const expires = new Date(now + GUEST_SESSION_SECONDS * 1000)
    // Validate signing configuration before inserting a historical session.
    signGuestToken({ id: '00000000-0000-0000-0000-000000000000', nickname, expires_at: expires.toISOString() })
    const { data, error } = await supabase.from('guest_sessions').insert({ nickname, created_at: new Date(now).toISOString(), expires_at: expires.toISOString(), last_active_at: new Date(now).toISOString() }).select('id, nickname, expires_at').single()
    if (error || !data) throw new Error(error?.message || 'Session indisponible')
    const response = NextResponse.json({ session: publicSession(data) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(GUEST_COOKIE_NAME, signGuestToken(data), guestCookieOptions(expires))
    trackEvent('guest_session_created', { guestSessionId: data.id })
    return response
  } catch {
    return NextResponse.json({ error: 'Impossible de créer la session invitée.' }, { status: 503 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) throw new Error('Base de données indisponible')
    const session = await resolveGuestSession(supabase, request.cookies.get(GUEST_COOKIE_NAME)?.value)
    const response = NextResponse.json({ session: session ? publicSession(session) : null }, { status: session ? 200 : 401, headers: { 'Cache-Control': 'no-store' } })
    if (!session) response.cookies.set(GUEST_COOKIE_NAME, '', { ...guestCookieOptions(new Date(0)), maxAge: 0 })
    return response
  } catch { return NextResponse.json({ error: 'Session indisponible.' }, { status: 503 }) }
}

export async function DELETE(request: NextRequest) {
  if (!isSameSiteOrigin(request.headers.get('origin'), request.headers.get('host') || request.nextUrl.host)) return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 })
  const response = NextResponse.json({ session: null }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(GUEST_COOKIE_NAME, '', { ...guestCookieOptions(new Date(0)), maxAge: 0 })
  return response
}
