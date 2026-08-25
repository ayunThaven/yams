import { SupabaseClient } from '@supabase/supabase-js'

import { GameEndReason, GameState } from '../types/game'
import { finalizeGame } from './gameFinalization'
import { GameRepository } from './gameRepository'
import type { ScoreActionWrite } from './gameRepository'

/**
 * Records a completed game exactly once. The database function owns result
 * persistence and user-stat updates so clients cannot forge either value.
 */
export async function updateFinishedGame(
  supabase: SupabaseClient,
  roomId: string,
  gameState: GameState,
  reason: GameEndReason = 'completed'
): Promise<{ success: boolean; error?: string }> {
  if (gameState.roomId !== roomId) {
    return { success: false, error: 'Game state does not match the requested room.' }
  }

  try {
    const result = await finalizeGame(supabase, gameState, reason)
    if (!result.success) {
      console.error('[DB] Game finalization failed:', result.error)
    }
    return result
  } catch (error) {
    console.error('[DB] Unexpected game finalization error:', error)
    return { success: false, error: String(error) }
  }
}

export async function saveGameSnapshot(supabase: SupabaseClient, gameState: GameState): Promise<boolean> {
  try {
    await new GameRepository(supabase).save(gameState)
    return true
  } catch (error) {
    console.error('[DB] Snapshot persistence failed:', error)
    return false
  }
}

export async function saveScoreAction(
  supabase: SupabaseClient,
  gameState: GameState,
  action: ScoreActionWrite
): Promise<boolean> {
  try {
    await new GameRepository(supabase).saveScoreAction(gameState, action)
    return true
  } catch (error) {
    console.error('[DB] Score action persistence failed:', error)
    return false
  }
}

export async function updateGameStatus(
  supabase: SupabaseClient,
  roomId: string,
  status: 'waiting' | 'in_progress' | 'finished'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('games')
      .update({ status })
      .eq('id', roomId)

    if (error) {
      console.error('[DB] Game status update failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[DB] Unexpected game status error:', error)
    return { success: false, error: String(error) }
  }
}
