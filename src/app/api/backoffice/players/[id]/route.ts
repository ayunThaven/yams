import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

function suggestedAchievements(
  profile: Record<string, number>,
  owned: Set<string>,
  games: Array<{ yams_faces?: number[] | null }>
) {
  const candidates: string[] = []
  if (profile.parties_jouees >= 1) candidates.push('play_game')
  if (profile.parties_gagnees >= 1) candidates.push('win_game')
  if (profile.nombre_yams_realises >= 1) candidates.push('yams')
  for (const game of games) {
    for (const face of game.yams_faces ?? []) candidates.push(`yams_${face}`)
  }
  if (profile.meilleur_score >= 200) candidates.push('score_200')
  if (profile.meilleur_score >= 250) candidates.push('score_250')
  if (profile.meilleur_score >= 300) candidates.push('score_300')
  for (const level of [5, 10, 20, 30, 33, 40, 50]) if (profile.level >= level) candidates.push(`level_${level}`)
  for (const streak of [3, 5, 10]) if (profile.meilleure_serie_victoires >= streak) candidates.push(`streak_${streak}`)
  return [...new Set(candidates)].filter((id) => !owned.has(id))
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  const { id } = await context.params; const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const [{ data: profile }, { data: login }, { data: achievements }, { data: allAchievements }, { data: games }, { data: tickets }, { data: audit }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).maybeSingle(),
    supabase.from('auth_local_users').select('email').eq('id', id).maybeSingle(),
    supabase.from('user_achievements').select('achievement_id, unlocked_at, achievement:achievements(id,name,description,image_path,rarity,is_active)').eq('user_id', id).order('unlocked_at', { ascending: false }),
    supabase.from('achievements').select('id,name,description,image_path,rarity,category,is_active').eq('is_active', true).order('name'),
    supabase.from('game_results').select('game_id, score, won, abandoned, yams_count, yams_faces, score_sheet, reason, finalized_at, game:games(variant,winner)').eq('user_id', id).order('finalized_at', { ascending: false }).limit(20),
    supabase.from('bug_tickets').select('id,title,status,priority,game_id,created_at,updated_at').eq('reporter_user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('backoffice_audit_logs').select('id,actor_id,action,reason,before_data,after_data,metadata,created_at').eq('target_type', 'user').eq('target_id', id).order('created_at', { ascending: false }).limit(30),
  ])
  if (!profile) return new NextResponse('Not Found', { status: 404 })
  const owned = new Set((achievements ?? []).map((row) => row.achievement_id))
  const gameIds = (games ?? []).map((game) => game.game_id)
  const { data: actions } = gameIds.length ? await supabase.from('game_score_actions').select('*').in('game_id', gameIds).eq('user_id', id).order('created_at') : { data: [] }
  return NextResponse.json({ data: { profile: { ...profile, email: login?.email }, achievements, allAchievements, games, actions, tickets, audit, suggestions: suggestedAchievements(profile, owned, games ?? []) } }, { headers: { 'Cache-Control': 'no-store' } })
}
