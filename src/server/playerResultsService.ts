import { SupabaseClient } from '@supabase/supabase-js'
import type { PlayerResult } from '@/types/game'

export async function recordGamePlayerResult(
  supabase: SupabaseClient,
  result: PlayerResult
): Promise<{ recorded: boolean; error?: string }> {
  // The RPC inserts into game_player_results with UNIQUE (game_id, user_id).
  // A false return means the result was already counted and stats must not run again.
  const { data, error } = await supabase.rpc('record_game_player_result', {
    p_game_id: result.gameId,
    p_user_id: result.userId,
    p_player_name: result.playerName,
    p_score: result.score,
    p_won: result.won,
    p_abandoned: result.abandoned,
    p_yams_count: result.yamsCount,
    p_xp_gained: result.xpGained,
    p_reason: result.reason,
  })

  if (error) {
    console.error('[RESULTS] Erreur record_game_player_result:', error)
    return { recorded: false, error: error.message }
  }

  return { recorded: data === true }
}
