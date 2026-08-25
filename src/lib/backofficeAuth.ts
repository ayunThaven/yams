import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from './supabase/admin'
import { hashOpaqueToken } from './backofficeCrypto'
import type { BackofficeRole } from '@/types/backoffice'

export const BACKOFFICE_DEVICE_COOKIE = 'yams_bo_device'
export const BACKOFFICE_SESSION_COOKIE = 'yams_bo_session'
export const BACKOFFICE_CHALLENGE_COOKIE = 'yams_bo_challenge'
const TWO_HOURS = 60 * 60 * 2

type BackofficeSession = {
  sub: string
  email: string
  role: BackofficeRole
  sessionVersion: number
  kind: 'backoffice-session'
}

type BackofficeChallenge = {
  sub: string
  kind: 'backoffice-challenge'
}

function jwtSecret(): string {
  const value = process.env.BACKOFFICE_JWT_SECRET
  if (!value) throw new Error('BACKOFFICE_JWT_SECRET manquant')
  return value
}

function shouldUseSecureBackofficeCookie(): boolean {
  const configured = process.env.BACKOFFICE_COOKIE_SECURE
  if (configured === 'true') return true
  if (configured === 'false') return false
  return process.env.NODE_ENV === 'production'
}

export function backofficeCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: shouldUseSecureBackofficeCookie(),
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  }
}

export async function validateDeviceToken(rawToken?: string | null) {
  if (!rawToken) return null
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('backoffice_devices')
    .select('id, user_id, invitation_id, expires_at, revoked_at')
    .eq('token_hash', hashOpaqueToken(rawToken))
    .maybeSingle()
  if (!data || data.revoked_at || new Date(data.expires_at) <= new Date()) return null
  await supabase.from('backoffice_devices').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return data
}

export async function requireBackofficeGate(request: NextRequest) {
  return validateDeviceToken(request.cookies.get(BACKOFFICE_DEVICE_COOKIE)?.value)
}

export function hiddenNotFound(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'
  try {
    return new URL(origin).host === request.nextUrl.host
  } catch {
    return false
  }
}

export async function authenticateBackofficePassword(email: string, password: string) {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('backoffice_users')
    .select('id, email, password_hash, role, totp_enabled, disabled_at')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (!data || data.disabled_at || !data.totp_enabled || !(await bcrypt.compare(password, data.password_hash))) return null
  return data
}

export function createChallengeToken(userId: string): string {
  return jwt.sign({ sub: userId, kind: 'backoffice-challenge' } satisfies BackofficeChallenge, jwtSecret(), { expiresIn: 300 })
}

export function readChallengeToken(value?: string | null): BackofficeChallenge | null {
  if (!value) return null
  try {
    const payload = jwt.verify(value, jwtSecret()) as BackofficeChallenge
    return payload.kind === 'backoffice-challenge' ? payload : null
  } catch {
    return null
  }
}

export function createSessionToken(user: Omit<BackofficeSession, 'kind'>): string {
  return jwt.sign({ ...user, kind: 'backoffice-session' } satisfies BackofficeSession, jwtSecret(), { expiresIn: TWO_HOURS })
}

export async function requireBackoffice(request: NextRequest, role?: 'admin') {
  const gate = await requireBackofficeGate(request)
  if (!gate) return { response: hiddenNotFound() }
  const raw = request.cookies.get(BACKOFFICE_SESSION_COOKIE)?.value
  if (!raw) return { response: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) }
  try {
    const payload = jwt.verify(raw, jwtSecret()) as BackofficeSession
    if (payload.kind !== 'backoffice-session') throw new Error('bad token')
    const supabase = createAdminClient()
    if (!supabase) throw new Error('database unavailable')
    const { data } = await supabase
      .from('backoffice_users')
      .select('id, email, role, session_version, disabled_at')
      .eq('id', payload.sub)
      .maybeSingle()
    if (!data || data.disabled_at || data.session_version !== payload.sessionVersion || (role && data.role !== role)) {
      return { response: role ? NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) : hiddenNotFound() }
    }
    if (gate.user_id && gate.user_id !== data.id) return { response: hiddenNotFound() }
    return { user: { id: data.id as string, email: data.email as string, role: data.role as BackofficeRole } }
  } catch {
    return { response: NextResponse.json({ error: 'Session expirée.' }, { status: 401 }) }
  }
}

export const BACKOFFICE_SESSION_SECONDS = TWO_HOURS
