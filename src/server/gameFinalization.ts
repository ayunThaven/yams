import { SupabaseClient } from '@supabase/supabase-js'

import { Achievement } from '@/types/achievement'
import { GameEndReason, GameState, PlayerGameState } from '@/types/game'
import { UserProfile } from '@/types/user'
import { countYamsInScoreSheet } from '@/lib/userStats'
import { trackEvent } from '@/lib/analytics'
import { getFinalizationAchievementIds } from './achievementRules'

type PersistedResult = {
  user_id: string | null
  player_name: string
  score: number
  won: boolean
  abandoned: boolean
  yams_count: number
  yams_faces: number[]
  score_sheet: PlayerGameState['scoreSheet']
  reason?: GameEndReason
}

type FinalizationResponse = {
  processed_user_ids?: string[]
  first_completion?: boolean
}

function toPersistedResults(gameState: GameState, reason: GameEndReason): PersistedResult[] {
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
      reason,
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

  if (error) throw new Error(`Achievement ${achievementId}: ${error.message}`)
  if (data !== true) return null

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
  results: PersistedResult[]
): Promise<Record<string, Achievement[]>> {
  const unlockedByUser: Record<string, Achievement[]> = {}

  for (const result of results) {
    const userId = result.user_id
    if (!userId) continue

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(`Profile ${userId}: ${error.message}`)
    if (!profile) throw new Error(`Profile ${userId} is missing`)

    const userProfile = profile as UserProfile
    const leaderboardRank = userProfile.parties_jouees >= 5
      ? await getLeaderboardRank(supabase, userId)
      : null
    const candidateIds = getFinalizationAchievementIds({
      result,
      profile: userProfile,
      variant: gameState.variant,
      leaderboardRank,
    })

    const unlocked = await Promise.all(
      candidateIds.map((achievementId) => unlockAchievement(supabase, userId, achievementId))
    )
    unlockedByUser[userId] = unlocked.filter((achievement): achievement is Achievement => achievement !== null)
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

  if (error) throw new Error(`Leaderboard rank: ${error.message}`)
  if (!data) return null
  const index = data.findIndex((row) => row.id === userId)
  return index === -1 ? null : index + 1
}

export async function finalizeGame(
  supabase: SupabaseClient,
  gameState: GameState,
  reason: GameEndReason = 'completed'
): Promise<{ success: boolean; achievements: Record<string, Achievement[]>; error?: string }> {
  const results = toPersistedResults(gameState, reason)
  const { data, error } = await supabase.rpc('finalize_game', {
    p_game_id: gameState.roomId,
    p_results: results,
  })

  if (error) {
    return { success: false, achievements: {}, error: error.message }
  }

  try {
    // Replay achievements from canonical rows even when this RPC inserted no
    // new result. An earlier attempt may have failed after the SQL commit.
    const { data: storedResults, error: readError } = await supabase
      .from('game_results')
      .select('user_id, player_name, score, won, abandoned, yams_count, yams_faces, score_sheet')
      .eq('game_id', gameState.roomId)
    if (readError) throw new Error(readError.message)
    const achievements = await unlockFinalizationAchievements(
      supabase, gameState, (storedResults ?? []) as PersistedResult[]
    )
    if ((data as FinalizationResponse | null)?.first_completion) {
      trackEvent('game_completed', { gameId: gameState.roomId, reason })
    }
    return { success: true, achievements }
  } catch (failure) {
    return { success: false, achievements: {}, error: String(failure) }
  }
}

export async function unlockActionAchievement(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string
): Promise<Achievement | null> {
  return unlockAchievement(supabase, userId, achievementId)
}
