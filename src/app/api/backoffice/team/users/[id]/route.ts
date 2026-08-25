import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request, 'admin'); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const { id } = await context.params; if (id === auth.user.id) return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre accès.' }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { role?: 'admin'|'operator'; disabled?: boolean }
  const updates: Record<string, unknown> = { session_version: undefined }
  if (body.role && ['admin','operator'].includes(body.role)) updates.role = body.role
  if (typeof body.disabled === 'boolean') updates.disabled_at = body.disabled ? new Date().toISOString() : null
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: before } = await supabase.from('backoffice_users').select('id,email,role,disabled_at,session_version').eq('id', id).maybeSingle(); if (!before) return new NextResponse('Not Found', { status: 404 })
  updates.session_version = before.session_version + 1
  const { data: after, error } = await supabase.from('backoffice_users').update(updates).eq('id', id).select('id,email,role,disabled_at,session_version').single()
  if (error) return NextResponse.json({ error: 'Modification impossible.' }, { status: 400 })
  if (body.disabled) await supabase.from('backoffice_devices').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).is('revoked_at', null)
  await supabase.from('backoffice_audit_logs').insert({ actor_id: auth.user.id, action: 'team.user.updated', target_type: 'backoffice_user', target_id: id, before_data: before, after_data: after })
  return NextResponse.json({ data: after }, { headers: { 'Cache-Control': 'no-store' } })
}
