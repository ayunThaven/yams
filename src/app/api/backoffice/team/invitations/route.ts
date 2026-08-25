import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { hashOpaqueToken, randomToken } from '@/lib/backofficeCrypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBackofficeAccessEmail } from '@/lib/emailSender'

export async function GET(request: NextRequest) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase.from('backoffice_users').select('id,email,role,totp_enabled,disabled_at,created_at').order('created_at'),
    supabase.from('backoffice_invitations').select('id,email,role,expires_at,used_at,created_at').order('created_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ users, invitations }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { email?: string; role?: 'admin' | 'operator' }
  const email = body.email?.trim().toLowerCase(); if (!email || !/^\S+@\S+\.\S+$/.test(email) || !['admin','operator'].includes(body.role || '')) return NextResponse.json({ error: 'Invitation invalide.' }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const invitationToken = randomToken(32); const accessToken = randomToken(32); const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data: invitation, error } = await supabase.from('backoffice_invitations').insert({ email, role: body.role, token_hash: hashOpaqueToken(invitationToken), invited_by: auth.user.id, expires_at: expiresAt }).select('id').single()
  if (error || !invitation) return NextResponse.json({ error: 'Invitation impossible.' }, { status: 409 })
  const { error: linkError } = await supabase.from('backoffice_access_links').insert({ invitation_id: invitation.id, token_hash: hashOpaqueToken(accessToken), created_by: auth.user.id, expires_at: expiresAt })
  if (linkError) return NextResponse.json({ error: 'Lien privé impossible.' }, { status: 500 })
  const baseUrl = (process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(/\/$/, '')
  const accessUrl = `${baseUrl}/api/private-access/${encodeURIComponent(accessToken)}?invite=${encodeURIComponent(invitationToken)}`
  await sendBackofficeAccessEmail({ to: email, accessUrl })
  await supabase.from('backoffice_audit_logs').insert({ actor_id: auth.user.id, action: 'team.invited', target_type: 'invitation', target_id: invitation.id, after_data: { email, role: body.role, expiresAt } })
  return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
