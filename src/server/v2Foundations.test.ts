import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameState } from '@/types/game'
import { createEmptyScoreSheet } from '@/lib/yamsLogic'
import { finalizeGame } from './gameFinalization'
import { canPlayMatchType } from './ratingService'

test('ranked eligibility is reserved for authenticated users', () => {
  assert.equal(canPlayMatchType({ kind: 'GUEST', guestSessionId: 'guest-1' }, 'CASUAL'), true)
  assert.equal(canPlayMatchType({ kind: 'GUEST', guestSessionId: 'guest-1' }, 'RANKED'), false)
  assert.equal(canPlayMatchType({ kind: 'USER', userId: 'user-1' }, 'RANKED'), true)
})

test('a failed achievement can be retried without applying the result and XP twice', async () => {
  const gameState: GameState = {
    roomId: 'RETRY001',
    players: [{
      id: 'socket-1', name: 'Alice', userId: 'user-1',
      scoreSheet: createEmptyScoreSheet(), totalScore: 100, abandoned: false,
    }],
    currentPlayerIndex: 0, dice: [], rollsLeft: 0, turnNumber: 13,
    gameStatus: 'finished', winner: 'Alice', variant: 'classic',
  }
  let finalizedCalls = 0
  let statsApplications = 0
  let failPlayAchievement = true
  const unlocked = new Set<string>()
  let storedResult: Record<string, unknown> | null = null

  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'finalize_game') {
        finalizedCalls += 1
        if (!storedResult) {
          statsApplications += 1
          const input = (args.p_results as Array<Record<string, unknown>>)[0]
          storedResult = { ...input }
        }
        return { data: { first_completion: finalizedCalls === 1 }, error: null }
      }
      if (name === 'unlock_achievement') {
        const achievementId = args.p_achievement_id as string
        if (achievementId === 'play_game' && failPlayAchievement) {
          failPlayAchievement = false
          return { data: null, error: { message: 'temporary database failure' } }
        }
        const first = !unlocked.has(achievementId)
        unlocked.add(achievementId)
        return { data: first, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          then: (resolve: (value: unknown) => void) => resolve(
            table === 'game_results'
              ? { data: storedResult ? [storedResult] : [], error: null }
              : { data: null, error: null }
          ),
          maybeSingle: async () => ({
            data: table === 'users'
              ? { id: 'user-1', parties_jouees: 1, parties_gagnees: 1, level: 1, serie_victoires_actuelle: 1 }
              : { id: 'play_game', name: 'Played' },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient

  const first = await finalizeGame(supabase, gameState)
  assert.equal(first.success, false)
  const retry = await finalizeGame(supabase, gameState)
  assert.equal(retry.success, true)
  assert.equal(finalizedCalls, 2)
  assert.equal(statsApplications, 1)
  assert.equal(unlocked.has('play_game'), true)
})
