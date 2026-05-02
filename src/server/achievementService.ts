import { SupabaseClient } from '@supabase/supabase-js'
import type { Achievement } from '@/types/achievement'

export async function unlockAchievementForUser(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string
): Promise<Achievement | null> {
  const { data, error } = await supabase.rpc('unlock_achievement', {
    p_user_id: userId,
    p_achievement_id: achievementId,
  })

  if (error) {
    console.error('[ACHIEVEMENTS] Erreur RPC unlock_achievement:', error)
    return null
  }

  if (data !== true) {
    return null
  }

  const { data: achievement, error: achievementError } = await supabase
    .from('achievements')
    .select('*')
    .eq('id', achievementId)
    .maybeSingle()

  if (achievementError) {
    console.warn('[ACHIEVEMENTS] Succès débloqué mais métadonnées introuvables:', achievementError)
    return null
  }

  return (achievement as Achievement | null) ?? null
}

export async function unlockAchievementsForUser(
  supabase: SupabaseClient,
  userId: string,
  achievementIds: string[]
): Promise<Achievement[]> {
  const unlocked: Achievement[] = []

  for (const achievementId of achievementIds) {
    const achievement = await unlockAchievementForUser(supabase, userId, achievementId)
    if (achievement) {
      unlocked.push(achievement)
    }
  }

  return unlocked
}
