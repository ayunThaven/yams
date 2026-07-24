import { NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

function clientAddress(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export async function allowAuthAttempt(
  request: NextRequest,
  action: 'login' | 'register' | 'request-reset'
): Promise<boolean> {
  const supabase = createAdminClient()
  if (!supabase) return false

  const limits = {
    login: { limit: 10, window: 15 * 60 },
    register: { limit: 5, window: 60 * 60 },
    'request-reset': { limit: 5, window: 60 * 60 },
  }
  const { limit, window } = limits[action]
  const { data, error } = await supabase.rpc('consume_auth_rate_limit', {
    p_bucket: `${action}:${clientAddress(request)}`,
    p_limit: limit,
    p_window_seconds: window,
  })

  return !error && data === true
}
