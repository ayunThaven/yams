import jwt from 'jsonwebtoken'
import type { SupabaseClient } from '@supabase/supabase-js'

export const GUEST_COOKIE_NAME = 'yams_guest_token'
/** Absolute lifetime; activity never extends this deadline. */
export const GUEST_SESSION_SECONDS = 24 * 60 * 60
export type GuestSession = { id: string; nickname: string; expires_at: string }

export function validateGuestNickname(value: unknown): string | null {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) return null
  const nickname = value.trim().normalize('NFC')
  return [...nickname].length >= 1 && [...nickname].length <= 32 ? nickname : null
}

function secret(): string {
  const value = process.env.GUEST_JWT_SECRET
  if (!value || value === (process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET)) throw new Error('GUEST_JWT_SECRET dédié requis')
  return value
}

export function signGuestToken(session: GuestSession): string {
  return jwt.sign({ kind: 'GUEST', guestSessionId: session.id, exp: Math.floor(Date.parse(session.expires_at) / 1000) }, secret(), { algorithm: 'HS256' })
}

export function verifyGuestToken(token: string): string | null {
  try {
    const decoded: unknown = jwt.verify(token, secret(), { algorithms: ['HS256'] })
    if (!decoded || typeof decoded !== 'object') return null
    const payload = decoded as Record<string, unknown>
    if (payload.kind !== 'GUEST' || typeof payload.exp !== 'number'
      || typeof payload.guestSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.guestSessionId)) return null
    return payload.guestSessionId
  } catch { return null }
}

export async function resolveGuestSession(supabase: SupabaseClient, token?: string): Promise<GuestSession | null> {
  const id = token ? verifyGuestToken(token) : null
  if (!id) return null
  const { data, error } = await supabase.from('guest_sessions').select('id, nickname, expires_at').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at) <= Date.now()) return null
  const { error: activityError } = await supabase.from('guest_sessions').update({ last_active_at: new Date().toISOString() }).eq('id', id)
  if (activityError) throw new Error(activityError.message)
  return data as GuestSession
}

export function guestCookieOptions(expires: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires }
}
