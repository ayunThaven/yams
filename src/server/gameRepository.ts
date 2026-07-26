import { SupabaseClient } from '@supabase/supabase-js'

import { GameState } from '@/types/game'

export type StoredGameSnapshot = {
  gameId: string
  state: GameState
  version: number
  turnExpiresAt: number | null
}

const snapshotVersions = new Map<string, number>()

export class GameRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(gameState: GameState): Promise<void> {
    const expectedVersion = snapshotVersions.get(gameState.roomId) ?? 0
    const turnExpiresAt = gameState.turnStartTime && gameState.turnTimeLeft !== undefined
      ? new Date(gameState.turnStartTime + gameState.turnTimeLeft * 1000).toISOString()
      : null
    const { data, error } = await this.supabase.rpc('save_game_snapshot', {
      p_game_id: gameState.roomId,
      p_state: gameState,
      p_expected_version: expectedVersion,
      p_turn_expires_at: turnExpiresAt,
    })
    if (error || typeof data !== 'number') throw new Error(error?.message ?? 'Impossible de sauvegarder la partie.')
    snapshotVersions.set(gameState.roomId, data)
  }

  async loadActive(): Promise<StoredGameSnapshot[]> {
    const { data, error } = await this.supabase
      .from('game_snapshots')
      .select('game_id, state, version, turn_expires_at, games!inner(status)')
      .in('games.status', ['waiting', 'in_progress'])
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => {
      const snapshot = row as unknown as { game_id: string; state: GameState; version: number; turn_expires_at: string | null }
      snapshotVersions.set(snapshot.game_id, snapshot.version)
      return {
        gameId: snapshot.game_id,
        state: snapshot.state,
        version: snapshot.version,
        turnExpiresAt: snapshot.turn_expires_at ? new Date(snapshot.turn_expires_at).getTime() : null,
      }
    })
  }
}
