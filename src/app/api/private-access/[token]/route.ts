import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BACKOFFICE_DEVICE_COOKIE, backofficeCookieOptions, hiddenNotFound } from '@/lib/backofficeAuth'
import { hashOpaqueToken, randomToken } from '@/lib/backofficeCrypto'

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const supabase = createAdminClient()
  if (!supabase || token.length < 32) return hiddenNotFound()
  const rawDevice = randomToken(32)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: consumed, error } = await supabase.rpc('consume_backoffice_access_link', {
    p_link_hash: hashOpaqueToken(token),
    p_device_hash: hashOpaqueToken(rawDevice),
    p_label: request.headers.get('user-agent')?.slice(0, 250) || 'Appareil',
    p_device_expires_at: expiresAt,
  })
  if (error || !consumed) return hiddenNotFound()

  const invitationToken = request.nextUrl.searchParams.get('invite')
  const destination = invitationToken
    ? `/backoffice/activate?token=${encodeURIComponent(invitationToken)}`
    : '/backoffice/login'
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.set(BACKOFFICE_DEVICE_COOKIE, rawDevice, backofficeCookieOptions(30 * 24 * 60 * 60))
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
