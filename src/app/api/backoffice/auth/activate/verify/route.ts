import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BACKOFFICE_SESSION_COOKIE, BACKOFFICE_SESSION_SECONDS, backofficeCookieOptions, createSessionToken, hiddenNotFound, requireBackofficeGate, verifySameOrigin } from '@/lib/backofficeAuth'
import { createRecoveryCodes, decryptTotpSecret, hashOpaqueToken, verifyTotp } from '@/lib/backofficeCrypto'
import { allowAuthAttempt } from '@/lib/authRateLimit'

type SetupPayload = { sub: string; invitationId: string; kind: 'backoffice-setup' }

export async function POST(request: NextRequest) {
  const device = await requireBackofficeGate(request)
  if (!device || !verifySameOrigin(request)) return device ? NextResponse.json({ error: 'Requête refusée.' }, { status: 403 }) : hiddenNotFound()
  const body = await request.json().catch(() => ({})) as { setupToken?: string; code?: string }
  const secret = process.env.BACKOFFICE_JWT_SECRET
  if (!secret || !body.setupToken || !body.code) return NextResponse.json({ error: 'Activation invalide.' }, { status: 400 })
  let payload: SetupPayload
  try { payload = jwt.verify(body.setupToken, secret) as SetupPayload } catch { return NextResponse.json({ error: 'Activation expirée.' }, { status: 401 }) }
  if (payload.kind !== 'backoffice-setup' || device.user_id !== payload.sub) return hiddenNotFound()
  const limit = await allowAuthAttempt(request, 'backoffice-mfa', payload.sub)
  if (limit !== 'allowed') return NextResponse.json({ error: 'Vérification temporairement indisponible.' }, { status: limit === 'limited' ? 429 : 503 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: user } = await supabase.from('backoffice_users')
    .select('id, email, role, session_version, totp_secret_encrypted').eq('id', payload.sub).maybeSingle()
  if (!user?.totp_secret_encrypted || !(await verifyTotp(decryptTotpSecret(user.totp_secret_encrypted), body.code))) {
    return NextResponse.json({ error: 'Code TOTP invalide.' }, { status: 400 })
  }
  const recoveryCodes = createRecoveryCodes()
  const { data: activation, error } = await supabase.rpc('complete_backoffice_activation', {
    p_user_id: user.id,
    p_invitation_id: payload.invitationId,
    p_recovery_hashes: recoveryCodes.map(hashOpaqueToken),
  })
  if (error || !activation) return NextResponse.json({ error: 'Activation expirée ou déjà terminée.' }, { status: 409 })
  const response = NextResponse.json({ success: true, recoveryCodes }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BACKOFFICE_SESSION_COOKIE, createSessionToken({ sub: activation.id, email: activation.email, role: activation.role, sessionVersion: activation.session_version }), backofficeCookieOptions(BACKOFFICE_SESSION_SECONDS))
  return response
}
