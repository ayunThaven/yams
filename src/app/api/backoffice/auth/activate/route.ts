import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hiddenNotFound, requireBackofficeGate, verifySameOrigin } from '@/lib/backofficeAuth'
import { createTotpEnrollment, createTotpUri, decryptTotpSecret, encryptTotpSecret, hashOpaqueToken } from '@/lib/backofficeCrypto'

function setupToken(userId: string, invitationId: string) {
  const secret = process.env.BACKOFFICE_JWT_SECRET
  if (!secret) throw new Error('BACKOFFICE_JWT_SECRET manquant')
  return jwt.sign({ sub: userId, invitationId, kind: 'backoffice-setup' }, secret, { expiresIn: 600 })
}

export async function POST(request: NextRequest) {
  const device = await requireBackofficeGate(request)
  if (!device || !device.invitation_id) return hiddenNotFound()
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { token?: string; password?: string }
  if (!body.token || !body.password || body.password.length < 12) return NextResponse.json({ error: 'Mot de passe de 12 caractères minimum requis.' }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: invitation } = await supabase.from('backoffice_invitations')
    .select('id, email, role, expires_at, used_at').eq('token_hash', hashOpaqueToken(body.token)).eq('id', device.invitation_id).maybeSingle()
  if (!invitation || invitation.used_at || new Date(invitation.expires_at) <= new Date()) return hiddenNotFound()
  const { data: pendingUser } = await supabase.from('backoffice_users')
    .select('id,totp_secret_encrypted,totp_enabled').eq('email', invitation.email.toLowerCase()).maybeSingle()
  let secret: string
  let uri: string
  let user: { id: string }
  if (pendingUser && !pendingUser.totp_enabled && pendingUser.totp_secret_encrypted) {
    user = pendingUser
    secret = decryptTotpSecret(pendingUser.totp_secret_encrypted)
    uri = createTotpUri(invitation.email, secret)
  } else {
    if (pendingUser) return NextResponse.json({ error: 'Compte déjà activé.' }, { status: 409 })
    const enrollment = createTotpEnrollment(invitation.email)
    secret = enrollment.secret
    uri = enrollment.uri
    const { data: created, error } = await supabase.from('backoffice_users').insert({
      email: invitation.email.toLowerCase(), password_hash: await bcrypt.hash(body.password, 12), role: invitation.role,
      totp_secret_encrypted: encryptTotpSecret(secret), totp_enabled: false,
    }).select('id').single()
    if (error || !created) return NextResponse.json({ error: 'Activation impossible.' }, { status: 409 })
    user = created
  }
  await supabase.from('backoffice_devices').update({ user_id: user.id }).eq('id', device.id)
  return NextResponse.json({ setupToken: setupToken(user.id, invitation.id), qrCode: await QRCode.toDataURL(uri), manualSecret: secret }, { headers: { 'Cache-Control': 'no-store' } })
}
