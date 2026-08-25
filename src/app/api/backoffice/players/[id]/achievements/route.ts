import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const { id } = await context.params; const body = await request.json().catch(() => ({})) as { achievementId?: string; reason?: string; ticketId?: string; gameId?: string }
  if (!body.achievementId || !body.reason?.trim()) return NextResponse.json({ error: 'Succès et motif requis.' }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data, error } = await supabase.rpc('backoffice_grant_achievement', { p_actor_id: auth.user.id, p_user_id: id, p_achievement_id: body.achievementId, p_reason: body.reason, p_ticket_id: body.ticketId || null, p_game_id: body.gameId || null })
  if (error) return NextResponse.json({ error: 'Attribution impossible.' }, { status: 400 })
  return NextResponse.json({ granted: data === true }, { headers: { 'Cache-Control': 'no-store' } })
}
