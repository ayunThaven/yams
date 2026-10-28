import type { SupabaseClient } from '@supabase/supabase-js'
import type { Socket } from 'socket.io'
import { verifyJwtToken } from '@/lib/authServer'
import { GUEST_COOKIE_NAME, resolveGuestSession } from '@/lib/guestSession'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlayerIdentity } from '@/types/game'

export type ResolvedIdentity = PlayerIdentity & { playerName: string }
type CookieReader = { get(name: string): { value: string } | undefined }

export async function resolveRequestIdentity(cookies: CookieReader, supabase = createAdminClient()): Promise<ResolvedIdentity | null> {
  if (!supabase) throw new Error('Base de données indisponible')
  const token = cookies.get('yams_auth_token')?.value
  const user = token ? verifyJwtToken(token) : null
  if (user) {
    const { data, error } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return { kind: 'USER', userId: user.id, playerName: data.username }
  }
  const guest = await resolveGuestSession(supabase, cookies.get(GUEST_COOKIE_NAME)?.value)
  return guest ? { kind: 'GUEST', guestSessionId: guest.id, playerName: guest.nickname } : null
}

export async function resolveSocketIdentity(socket: Socket): Promise<ResolvedIdentity | null> {
  const values = new Map<string, string>()
  for (const entry of (socket.handshake.headers.cookie || '').split(';')) {
    const index = entry.indexOf('=')
    if (index < 0) continue
    try { values.set(entry.slice(0, index).trim(), decodeURIComponent(entry.slice(index + 1))) } catch { /* invalid cookie */ }
  }
  return resolveRequestIdentity({ get: name => values.has(name) ? { value: values.get(name)! } : undefined })
}

export function getSocketPlayerIdentity(socket: Socket): PlayerIdentity | null {
  return socket.data.identity ?? null
}

export async function ensureGamePlayer(supabase: SupabaseClient, gameId: string, identity: ResolvedIdentity): Promise<string> {
  const { data, error } = await supabase.rpc('join_casual_game', {
    p_game_id: gameId, p_user_id: identity.kind === 'USER' ? identity.userId : null,
    p_guest_session_id: identity.kind === 'GUEST' ? identity.guestSessionId : null,
    p_player_name: identity.playerName,
  })
  if (error || typeof data !== 'string') throw new Error(error?.message || 'Participant indisponible')
  return data
}
