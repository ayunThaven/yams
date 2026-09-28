import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchType, PlayerIdentity } from '@/types/game'
import type { UserRating } from '@/types/rating'

/** The server boundary for the future OpenSkill calculation and atomic apply. */
export function canPlayMatchType(identity: PlayerIdentity, matchType: MatchType): boolean {
  return matchType === 'CASUAL' || identity.kind === 'USER'
}

export async function getUserRating(supabase: SupabaseClient, userId: string): Promise<UserRating | null> {
  const { data, error } = await supabase.from('user_ratings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    userId: data.user_id,
    mu: Number(data.mu),
    sigma: Number(data.sigma),
    gamesPlayed: data.games_played,
    wins: data.wins,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
