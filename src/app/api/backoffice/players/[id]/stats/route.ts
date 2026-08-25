import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const FIELDS = new Set(['parties_jouees','parties_gagnees','parties_abandonnees','meilleur_score','nombre_yams_realises','meilleure_serie_victoires','serie_victoires_actuelle','xp'])
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const { id } = await context.params; const body = await request.json().catch(() => ({})) as { values?: Record<string, unknown>; reason?: string; ticketId?: string; gameId?: string }
  const values = Object.fromEntries(Object.entries(body.values ?? {}).filter(([key, value]) => FIELDS.has(key) && Number.isInteger(value)))
  if (!Object.keys(values).length || !body.reason?.trim()) return NextResponse.json({ error: 'Valeurs et motif requis.' }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data, error } = await supabase.rpc('backoffice_update_player_stats', { p_actor_id: auth.user.id, p_user_id: id, p_values: values, p_reason: body.reason, p_ticket_id: body.ticketId || null, p_game_id: body.gameId || null })
  if (error) return NextResponse.json({ error: error.message.includes('inconsistent') ? 'Statistiques incohérentes.' : 'Correction impossible.' }, { status: 400 })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

