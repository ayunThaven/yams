import { NextRequest, NextResponse } from 'next/server'
import {
  BACKOFFICE_CHALLENGE_COOKIE,
  BACKOFFICE_SESSION_COOKIE,
  BACKOFFICE_SESSION_SECONDS,
  backofficeCookieOptions,
  createSessionToken,
  hiddenNotFound,
  readChallengeToken,
  requireBackofficeGate,
  verifySameOrigin,
} from '@/lib/backofficeAuth'
import { decryptTotpSecret, hashOpaqueToken, verifyTotp } from '@/lib/backofficeCrypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowAuthAttempt } from '@/lib/authRateLimit'

export async function POST(request: NextRequest) {
  if (!(await requireBackofficeGate(request))) return hiddenNotFound()
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const challenge = readChallengeToken(request.cookies.get(BACKOFFICE_CHALLENGE_COOKIE)?.value)
  if (!challenge) return NextResponse.json({ error: 'Défi expiré.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { code?: string }
  const code = body.code?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code requis.' }, { status: 400 })
  const limit = await allowAuthAttempt(request, 'backoffice-mfa', challenge.sub)
  if (limit !== 'allowed') return NextResponse.json({ error: 'Vérification temporairement indisponible.' }, { status: limit === 'limited' ? 429 : 503 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: user } = await supabase.from('backoffice_users')
    .select('id, email, role, session_version, totp_secret_encrypted, disabled_at')
    .eq('id', challenge.sub).maybeSingle()
  if (!user || user.disabled_at || !user.totp_secret_encrypted) return NextResponse.json({ error: 'Code invalide.' }, { status: 400 })

  let valid = await verifyTotp(decryptTotpSecret(user.totp_secret_encrypted), code)
  if (!valid) {
    const codeHash = hashOpaqueToken(code)
    const { data: recoveryConsumed } = await supabase.rpc('consume_backoffice_recovery_code', {
      p_user_id: user.id,
      p_code_hash: codeHash,
    })
    valid = recoveryConsumed === true
  }
  if (!valid) return NextResponse.json({ error: 'Code invalide.' }, { status: 400 })
  const session = createSessionToken({ sub: user.id, email: user.email, role: user.role, sessionVersion: user.session_version })
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BACKOFFICE_SESSION_COOKIE, session, backofficeCookieOptions(BACKOFFICE_SESSION_SECONDS))
  response.cookies.set(BACKOFFICE_CHALLENGE_COOKIE, '', backofficeCookieOptions(0))
  return response
}
