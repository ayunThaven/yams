import { createHash } from 'crypto'

import { NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

function clientAddress(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function emailFingerprint(email: string | undefined): string | null {
  if (!email) return null
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24)
}

export type RateLimitResult = 'allowed' | 'limited' | 'unavailable'

export async function allowAuthAttempt(
  request: NextRequest,
  action: 'login' | 'register' | 'request-reset',
  email?: string
): Promise<RateLimitResult> {
  const supabase = createAdminClient()
  if (!supabase) return 'unavailable'

  const limits = {
    login: { limit: 10, window: 15 * 60 },
    register: { limit: 5, window: 60 * 60 },
    'request-reset': { limit: 5, window: 60 * 60 },
  }
  const { limit, window } = limits[action]
  const { data, error } = await supabase.rpc('consume_auth_rate_limit', {
    p_bucket: `${action}:${clientAddress(request)}:${emailFingerprint(email) ?? 'anonymous'}`,
    p_limit: limit,
    p_window_seconds: window,
  })

  if (error) {
    console.error('[AUTH] Rate-limit RPC unavailable:', error.message)
    return 'unavailable'
  }
  return data === true ? 'allowed' : 'limited'
}
