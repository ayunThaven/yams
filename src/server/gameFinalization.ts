import { SupabaseClient } from '@supabase/supabase-js'

import { Achievement } from '@/types/achievement'
import { GameEndReason, GameState, PlayerGameState } from '@/types/game'
import { UserProfile } from '@/types/user'
import { countYamsInScoreSheet } from '@/lib/userStats'
import { getFinalizationAchievementIds } from './achievementRules'

type PersistedResult = {
  user_id: string
  player_name: string
  score: number
  won: boolean
  abandoned: boolean
  yams_count: number
  yams_faces: number[]
  score_sheet: PlayerGameState['scoreSheet']
}

type FinalizationResponse = {
  processed_user_ids?: string[]
}

function toPersistedResults(gameState: GameState): PersistedResult[] {
  const activePlayers = gameState.players.filter((player) => !player.abandoned)
  const topScore = activePlayers.length > 0
    ? Math.max(...activePlayers.map((player) => player.totalScore))
    : null

  return gameState.players.flatMap((player) => {
    if (!player.userId) return []

    return [{
      user_id: player.userId,
      player_name: player.name,
      score: player.totalScore,
      won: !player.abandoned && topScore !== null && player.totalScore === topScore,
      abandoned: player.abandoned,
      yams_count: countYamsInScoreSheet(player.scoreSheet),
      yams_faces: player.yamsFaces ?? [],
      score_sheet: player.scoreSheet,
    }]
  })
}

async function unlockAchievement(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string
): Promise<Achievement | null> {
  const { data, error } = await supabase.rpc('unlock_achievement', {
    p_user_id: userId,
    p_achievement_id: achievementId,
  })

  if (error || data !== true) return null

  const { data: achievement } = await supabase
    .from('achievements')
    .select('*')
    .eq('id', achievementId)
    .maybeSingle()

  return (achievement as Achievement | null) ?? null
}

async function unlockFinalizationAchievements(
  supabase: SupabaseClient,
  gameState: GameState,
  results: PersistedResult[],
  processedUserIds: string[]
): Promise<Record<string, Achievement[]>> {
  const unlockedByUser: Record<string, Achievement[]> = {}

  for (const result of results) {
    if (!processedUserIds.includes(result.user_id)) continue

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', result.user_id)
      .maybeSingle()

    if (error || !profile) continue

    const userProfile = profile as UserProfile
    const leaderboardRank = userProfile.parties_jouees >= 5
      ? await getLeaderboardRank(supabase, result.user_id)
      : null
    const candidateIds = getFinalizationAchievementIds({
      result,
      profile: userProfile,
      variant: gameState.variant,
      leaderboardRank,
    })

    const unlocked = await Promise.all(
      candidateIds.map((achievementId) => unlockAchievement(supabase, result.user_id, achievementId))
    )
    unlockedByUser[result.user_id] = unlocked.filter((achievement): achievement is Achievement => achievement !== null)
  }

  return unlockedByUser
}

async function getLeaderboardRank(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('id')
    .gte('parties_jouees', 5)
    .order('taux_victoire', { ascending: false })
    .order('serie_victoires_actuelle', { ascending: false })
    .order('parties_jouees', { ascending: false })
    .order('nombre_yams_realises', { ascending: false })
    .limit(5)

  if (error || !data) return null
  const index = data.findIndex((row) => row.id === userId)
  return index === -1 ? null : index + 1
}

export async function finalizeGame(
  supabase: SupabaseClient,
  gameState: GameState,
  reason: GameEndReason = 'completed'
): Promise<{ success: boolean; achievements: Record<string, Achievement[]>; error?: string }> {
  const results = toPersistedResults(gameState)
  const { data, error } = await supabase.rpc('finalize_game', {
    p_game_id: gameState.roomId,
    p_results: results,
  })

  if (error) {
    return { success: false, achievements: {}, error: error.message }
  }

  const processedUserIds = ((data as FinalizationResponse | null)?.processed_user_ids ?? [])
  await Promise.all(results.map((result) => supabase.from('game_results').update({
    yams_faces: result.yams_faces,
    reason,
  }).eq('game_id', gameState.roomId).eq('user_id', result.user_id)))
  const achievements = await unlockFinalizationAchievements(supabase, gameState, results, processedUserIds)

  return { success: true, achievements }
}

export async function unlockActionAchievement(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string
): Promise<Achievement | null> {
  return unlockAchievement(supabase, userId, achievementId)
}
