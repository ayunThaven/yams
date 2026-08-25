import { SupabaseClient } from '@supabase/supabase-js'
import type { Server } from 'socket.io'

import { GameEndReason, GameState } from '../types/game'
import { Achievement } from '../types/achievement'
import { finalizeGame } from './gameFinalization'
import { GameRepository } from './gameRepository'
import type { ScoreActionWrite } from './gameRepository'

export type FinishedGameUpdateResult = {
  success: boolean
  achievements: Record<string, Achievement[]>
  error?: string
}

/**
 * Records a completed game exactly once. The database function owns result
 * persistence and user-stat updates so clients cannot forge either value.
 */
export async function updateFinishedGame(
  supabase: SupabaseClient,
  roomId: string,
  gameState: GameState,
  reason: GameEndReason = 'completed'
): Promise<FinishedGameUpdateResult> {
  if (gameState.roomId !== roomId) {
    return {
      success: false,
      achievements: {},
      error: 'Game state does not match the requested room.',
    }
  }

  try {
    const result = await finalizeGame(supabase, gameState, reason)
    if (!result.success) {
      console.error('[DB] Game finalization failed:', result.error)
    }
    return result
  } catch (error) {
    console.error('[DB] Unexpected game finalization error:', error)
    return { success: false, achievements: {}, error: String(error) }
  }
}

/** Sends newly unlocked achievements only to the player who earned them. */
export function emitUnlockedAchievements(
  io: Server,
  gameState: GameState,
  achievementsByUser: Record<string, Achievement[]>
): void {
  for (const player of gameState.players) {
    if (!player.userId) continue

    const achievements = achievementsByUser[player.userId]
    if (!achievements?.length) continue

    io.to(player.id).emit('achievements_unlocked', achievements)
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
