import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { hashOpaqueToken, randomToken } from '@/lib/backofficeCrypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBackofficeAccessEmail } from '@/lib/emailSender'

export async function GET(request: NextRequest) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data } = await supabase.from('backoffice_devices').select('id,user_id,label,last_used_at,expires_at,revoked_at,created_at,user:backoffice_users(email)').order('created_at', { ascending: false })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { userId?: string }
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: user } = await supabase.from('backoffice_users').select('id,email').eq('id', body.userId).is('disabled_at', null).maybeSingle(); if (!user) return new NextResponse('Not Found', { status: 404 })
  const raw = randomToken(32); const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { error: linkError } = await supabase.from('backoffice_access_links').insert({ user_id: user.id, token_hash: hashOpaqueToken(raw), created_by: auth.user.id, expires_at: expiresAt })
  if (linkError) return NextResponse.json({ error: 'Lien privé impossible.' }, { status: 500 })
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(request.nextUrl.hostname)
  const baseUrl = localHost
    ? request.nextUrl.origin
    : (process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(/\/$/, '')
  const accessUrl = `${baseUrl}/api/private-access/${encodeURIComponent(raw)}`
  if (localHost) {
    return NextResponse.json({ success: true, accessUrl, expiresAt }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    await sendBackofficeAccessEmail({ to: user.email, accessUrl })
  } catch (error) {
    console.error('[BACKOFFICE] Device-link email failed:', error)
    return NextResponse.json({ error: 'Lien créé, mais son envoi par e-mail a échoué. Générez-en un nouveau après avoir corrigé SendGrid.' }, { status: 502 })
  }
  return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const id = request.nextUrl.searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Appareil requis.' }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: before } = await supabase.from('backoffice_devices').select('*').eq('id', id).maybeSingle(); if (!before) return new NextResponse('Not Found', { status: 404 })
  await supabase.from('backoffice_devices').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  await supabase.from('backoffice_audit_logs').insert({ actor_id: auth.user.id, action: 'device.revoked', target_type: 'device', target_id: id, before_data: before })
  return NextResponse.json({ success: true })
}
