import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const { id } = await context.params; const body = await request.json().catch(() => ({})) as { resolution?: string }
  if (!body.resolution?.trim()) return NextResponse.json({ error: 'Résumé de résolution requis.' }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data, error } = await supabase.rpc('backoffice_resolve_ticket_with_reward', { p_actor_id: auth.user.id, p_ticket_id: id, p_resolution: body.resolution })
  if (error) return NextResponse.json({ error: 'Le ticket doit être confirmé avant sa résolution.' }, { status: 400 })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

