/**
 * Système de détection et déblocage des achievements
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Achievement, AchievementCheckContext } from '@/types/achievement'
import { logger } from './logger'

/**
 * Vérifie quels achievements peuvent être débloqués et les débloque
 */
export async function checkAndUnlockAchievements(
  supabase: SupabaseClient,
  userId: string,
  context: AchievementCheckContext
): Promise<Achievement[]> {
  const unlocked: Achievement[] = []

  try {
    // Récupérer les achievements déjà débloqués
    const { data: unlockedAchievements, error: fetchError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)

    if (fetchError) {
      logger.error('Erreur lors de la récupération des achievements:', fetchError)
      return unlocked
    }

    const unlockedIds = new Set(unlockedAchievements?.map(a => a.achievement_id) || [])

    // Liste des checks à effectuer
    const checks: Array<{ id: string; check: () => boolean }> = [
      // Yams 
      {
        id: 'yams',
        check: () =>
          context.userProfile.nombre_yams_realises >= 1 && !unlockedIds.has('yams'),
      },
      {
        id: 'yams_1',
        check: () =>
          (context.gameData.yamsByFace?.[1] ?? 0) >= 1 && !unlockedIds.has('yams_1'),
      },
      {
        id: 'yams_2',
        check: () =>
          (context.gameData.yamsByFace?.[2] ?? 0) >= 1 && !unlockedIds.has('yams_2'),
      },
      {
        id: 'yams_3',
        check: () =>
          (context.gameData.yamsByFace?.[3] ?? 0) >= 1 && !unlockedIds.has('yams_3'),
      },
      {
        id: 'yams_4',
        check: () =>
          (context.gameData.yamsByFace?.[4] ?? 0) >= 1 && !unlockedIds.has('yams_4'),
      },
      {
        id: 'yams_5',
        check: () =>
          (context.gameData.yamsByFace?.[5] ?? 0) >= 1 && !unlockedIds.has('yams_5'),
      },
      {
        id: 'yams_6',
        check: () =>
          (context.gameData.yamsByFace?.[6] ?? 0) >= 1 && !unlockedIds.has('yams_6'),
      },

      // Scores
      {
        id: 'score_200',
        check: () => context.gameData.score >= 200 && !unlockedIds.has('score_200'),
      },
      {
        id: 'score_250',
        check: () => context.gameData.score >= 250 && !unlockedIds.has('score_250'),
      },
      {
        id: 'score_300',
        check: () => context.gameData.score >= 300 && !unlockedIds.has('score_300'),
      },
      {
        id: 'perfect_game',
        check: () => context.gameData.score === 375 && !unlockedIds.has('perfect_game'),
      },

      // Victoires
      {
        id: 'win_game',
        check: () => context.gameData.won && context.userProfile.parties_gagnees >= 1 && !unlockedIds.has('win_game'),
      },
      {
        id: 'loose_game',
        check: () => {
          // Ne pas débloquer si le joueur a abandonné (ce n'est pas une défaite)
          if (context.gameData.abandoned) {
            return false
          }
          
          // Ne pas débloquer si le joueur a gagné
          if (context.gameData.won) {
            return false
          }
          
          // Première défaite : avant cette partie, aucune défaite
          // => parties_jouees_avant === parties_gagnees_avant
          // On utilise les stats AVANT cette partie si disponibles, sinon on les calcule
          const partiesJoueesAvant = context.userProfile.parties_jouees_avant ?? 
            Math.max(0, context.userProfile.parties_jouees - 1)
          const partiesGagneesAvant = context.userProfile.parties_gagnees_avant ?? 
            (context.userProfile.parties_gagnees - (context.gameData.won ? 1 : 0))
          
          // Première défaite si :
          // - C'est la première partie (parties_jouees_avant === 0) ET c'est une défaite
          // - OU toutes les parties précédentes étaient des victoires (parties_jouees_avant === parties_gagnees_avant > 0)
          return (
            (partiesJoueesAvant === 0 || partiesJoueesAvant === partiesGagneesAvant) &&
            !unlockedIds.has('loose_game')
          )
        },
      },
      {
        id: 'champion',
        check: () => {
          const games = context.userProfile.parties_jouees
          const wins = context.userProfile.parties_gagnees

          if (games < 10) return false

          const winRate = wins / games
          return winRate >= 0.75 && !unlockedIds.has('champion')
        },
      },
      {
        id: 'streak_3',
        check: () => context.userProfile.serie_victoires_actuelle >= 3 && !unlockedIds.has('streak_3'),
      },
      {
        id: 'streak_5',
        check: () => context.userProfile.serie_victoires_actuelle >= 5 && !unlockedIds.has('streak_5'),
      },
      {
        id: 'streak_10',
        check: () => context.userProfile.serie_victoires_actuelle >= 10 && !unlockedIds.has('streak_10'),
      },

      // Niveaux
      {
        id: 'level_5',
        check: () => context.userProfile.level >= 5 && !unlockedIds.has('level_5'),
      },
      {
        id: 'level_10',
        check: () => context.userProfile.level >= 10 && !unlockedIds.has('level_10'),
      },
      {
        id: 'level_20',
        check: () => context.userProfile.level >= 20 && !unlockedIds.has('level_20'),
      },
      {
        id: 'level_30',
        check: () => context.userProfile.level >= 30 && !unlockedIds.has('level_30'),
      },
      {
        id: 'level_33',
        check: () => context.userProfile.level >= 33 && !unlockedIds.has('level_33'),
      },
      {
        id: 'level_40',
        check: () => context.userProfile.level >= 40 && !unlockedIds.has('level_40'),
      },
      {
        id: 'level_50',
        check: () => context.userProfile.level >= 50 && !unlockedIds.has('level_50'),
      },

      // Bonus
      {
        id: 'bonus',
        check: () => context.gameData.hasBonus && !unlockedIds.has('bonus'),
      },

      // Variantes
      {
        id: 'variant_descending',
        check: () => context.gameData.variant === 'descending' && !unlockedIds.has('variant_descending'),
      },
      {
        id: 'variant_ascending',
        check: () => context.gameData.variant === 'ascending' && !unlockedIds.has('variant_ascending'),
      },

      // Actions
      {
        id: 'play_game',
        check: () => context.userProfile.parties_jouees >= 1 && !unlockedIds.has('play_game'),
      },
    ]

    // Vérifier chaque achievement
    for (const { id, check } of checks) {
      if (check()) {
        // Débloquer l'achievement
        const { data, error } = await supabase.rpc('unlock_achievement', {
          p_user_id: userId,
          p_achievement_id: id,
        })

        if (data && !error) {
          // Récupérer les détails de l'achievement
          const { data: achievement, error: achievementError } = await supabase
            .from('achievements')
            .select('*')
            .eq('id', id)
            .single()

          if (achievement && !achievementError) {
            unlocked.push(achievement as Achievement)
            logger.success(`Achievement débloqué: ${achievement.name}`)
          }
        }
      }
    }
  } catch (error) {
    logger.error('Erreur lors de la vérification des achievements:', error)
  }

  return unlocked
}

