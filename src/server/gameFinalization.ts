import { SupabaseClient } from '@supabase/supabase-js'

import { Achievement } from '@/types/achievement'
import { GameState, PlayerGameState } from '@/types/game'
import { UserProfile } from '@/types/user'
import { countYamsInScoreSheet } from '@/lib/userStats'

type PersistedResult = {
  user_id: string
  player_name: string
  score: number
  won: boolean
  abandoned: boolean
  yams_count: number
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
    const candidateIds = new Set<string>(['play_game'])

    if (result.abandoned) candidateIds.add('give_up')
    if (result.won) candidateIds.add('win_game')
    if (result.yams_count > 0) candidateIds.add('yams')
    if (result.score >= 200) candidateIds.add('score_200')
    if (result.score >= 250) candidateIds.add('score_250')
    if (result.score >= 300) candidateIds.add('score_300')
    if (result.score === 375) candidateIds.add('perfect_game')
    if (gameState.variant === 'ascending') candidateIds.add('variant_ascending')
    if (gameState.variant === 'descending') candidateIds.add('variant_descending')
    if (Object.values(result.score_sheet).slice(0, 6).reduce((sum, score) => sum + (score ?? 0), 0) >= 63) {
      candidateIds.add('bonus')
    }

    for (const level of [5, 10, 20, 30, 33, 40, 50]) {
      if (userProfile.level >= level) candidateIds.add(`level_${level}`)
    }
    for (const streak of [3, 5, 10]) {
      if (userProfile.serie_victoires_actuelle >= streak) candidateIds.add(`streak_${streak}`)
    }
    if (userProfile.parties_jouees >= 10 && userProfile.parties_gagnees / userProfile.parties_jouees >= 0.75) {
      candidateIds.add('champion')
    }

    const unlocked = await Promise.all(
      [...candidateIds].map((achievementId) => unlockAchievement(supabase, result.user_id, achievementId))
    )
    unlockedByUser[result.user_id] = unlocked.filter((achievement): achievement is Achievement => achievement !== null)
  }

  return unlockedByUser
}

export async function finalizeGame(
  supabase: SupabaseClient,
  gameState: GameState
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
