import { SupabaseClient } from '@supabase/supabase-js'
import type { PlayerResult } from '@/types/game'

export async function recordGamePlayerResult(
  supabase: SupabaseClient,
  result: PlayerResult
): Promise<{ recorded: boolean; error?: string }> {
  // game_results is the canonical, idempotent source for every end path.
  const { data, error } = await supabase.rpc('record_canonical_game_result', {
    p_game_id: result.gameId,
    p_user_id: result.userId,
    p_player_name: result.playerName,
    p_score: result.score,
    p_won: result.won,
    p_abandoned: result.abandoned,
    p_yams_count: result.yamsCount,
    p_xp_gained: result.xpGained,
    p_reason: result.reason,
    p_yams_faces: result.yamsFaces ?? [],
    p_score_sheet: result.scoreSheet ?? {},
  })

  if (error) {
    console.error('[RESULTS] Erreur record_canonical_game_result:', error)
    return { recorded: false, error: error.message }
  }

  return { recorded: data === true }
}
