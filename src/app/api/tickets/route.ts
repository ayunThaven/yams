import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authRequest'
import { createAdminClient } from '@/lib/supabase/admin'

function publicTicket(row: Record<string, unknown>) {
  const safe = { ...row }
  delete safe.internal_notes
  delete safe.assigned_to
  delete safe.client_context
  return safe
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth.response) return auth.response
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const from = (page - 1) * 20
  const { data, error, count } = await supabase.from('bug_tickets').select('*', { count: 'exact' })
    .eq('reporter_user_id', auth.user.id).order('created_at', { ascending: false }).range(from, from + 19)
  if (error) return NextResponse.json({ error: 'Impossible de charger les tickets.' }, { status: 500 })
  return NextResponse.json({ data: (data ?? []).map((row) => publicTicket(row)), page, total: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth.response) return auth.response
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const text = (key: string, max: number) => typeof body[key] === 'string' ? String(body[key]).trim().slice(0, max) : ''
  const title = text('title', 160)
  const description = text('description', 10000)
  if (title.length < 5 || description.length < 10) return NextResponse.json({ error: 'Titre ou description trop court.' }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const gameId = typeof body.gameId === 'string' && body.gameId ? body.gameId : null
  if (gameId) {
    const { data: result } = await supabase.from('game_results').select('game_id').eq('game_id', gameId).eq('user_id', auth.user.id).maybeSingle()
    if (!result) return NextResponse.json({ error: 'Partie non autorisée.' }, { status: 400 })
  }
  const { data, error } = await supabase.from('bug_tickets').insert({
    reporter_user_id: auth.user.id,
    game_id: gameId,
    title,
    description,
    reproduction_steps: text('reproductionSteps', 10000),
    expected_behavior: text('expectedBehavior', 5000),
    actual_behavior: text('actualBehavior', 5000),
    client_context: {
      route: text('route', 500),
      userAgent: request.headers.get('user-agent')?.slice(0, 1000),
      appVersion: process.env.npm_package_version || 'unknown',
      reportedAt: new Date().toISOString(),
    },
  }).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Impossible de créer le ticket.' }, { status: 500 })
  return NextResponse.json({ data: publicTicket(data) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
