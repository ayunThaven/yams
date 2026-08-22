import { GameVariant, ScoreSheet } from '@/types/game'
import { UserProfile } from '@/types/user'

export const ACTION_ACHIEVEMENT_IDS = [
  'create_game',
  'create_private_game',
  'join_game',
] as const

export const FINALIZATION_ACHIEVEMENT_IDS = [
  'yams',
  'yams_1',
  'yams_2',
  'yams_3',
  'yams_4',
  'yams_5',
  'yams_6',
  'score_200',
  'score_250',
  'score_300',
  'win_game',
  'loose_game',
  'streak_3',
  'streak_5',
  'streak_10',
  'level_5',
  'level_10',
  'level_20',
  'level_30',
  'level_40',
  'level_50',
  'bonus',
  'variant_descending',
  'variant_ascending',
  'play_game',
  'give_up',
  'top_1',
  'top_2',
  'top_3',
  'top_5',
  'champion',
  'perfect_game',
  'yatzhee',
] as const

export const AUTOMATIC_ACHIEVEMENT_IDS = [
  ...ACTION_ACHIEVEMENT_IDS,
  ...FINALIZATION_ACHIEVEMENT_IDS,
] as const

export const MANUAL_ACHIEVEMENT_IDS = ['bug_finder'] as const

// These achievements describe features which are not available in the current game.
export const INACTIVE_ACHIEVEMENT_IDS = ['all_in_one', 'win_all_in_one', 'friend_1'] as const

type FinalizedResult = {
  score: number
  won: boolean
  abandoned: boolean
  yams_count: number
  yams_faces: number[]
  score_sheet: ScoreSheet
}

type AchievementProfile = Pick<
  UserProfile,
  'level' | 'parties_jouees' | 'parties_gagnees' | 'serie_victoires_actuelle'
>

export type FinalizationAchievementContext = {
  result: FinalizedResult
  profile: AchievementProfile
  variant: GameVariant
  leaderboardRank: number | null
}

const upperSectionCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const

export function getFinalizationAchievementIds({
  result,
  profile,
  variant,
  leaderboardRank,
}: FinalizationAchievementContext): string[] {
  const candidateIds = new Set<string>(['play_game'])
  const yamsFaces = new Set(result.yams_faces.filter((face) => Number.isInteger(face) && face >= 1 && face <= 6))
  const madeYams = result.yams_count > 0 || yamsFaces.size > 0

  if (result.abandoned) candidateIds.add('give_up')
  if (result.won) candidateIds.add('win_game')
  if (!result.won && !result.abandoned) candidateIds.add('loose_game')

  if (madeYams) candidateIds.add('yams')
  for (const face of yamsFaces) candidateIds.add(`yams_${face}`)

  if (result.score >= 200) candidateIds.add('score_200')
  if (result.score >= 250) candidateIds.add('score_250')
  if (result.score >= 300) candidateIds.add('score_300')
  if (result.won && result.score === 375) candidateIds.add('perfect_game')
  if (result.won && madeYams) candidateIds.add('yatzhee')

  if (variant === 'ascending') candidateIds.add('variant_ascending')
  if (variant === 'descending') candidateIds.add('variant_descending')

  const upperSectionScore = upperSectionCategories.reduce(
    (sum, category) => sum + (result.score_sheet[category] ?? 0),
    0
  )
  if (upperSectionScore >= 63) candidateIds.add('bonus')

  for (const level of [5, 10, 20, 30, 40, 50]) {
    if (profile.level >= level) candidateIds.add(`level_${level}`)
  }
  for (const streak of [3, 5, 10]) {
    if (profile.serie_victoires_actuelle >= streak) candidateIds.add(`streak_${streak}`)
  }
  if (profile.parties_jouees >= 10 && profile.parties_gagnees / profile.parties_jouees >= 0.75) {
    candidateIds.add('champion')
  }

  if (leaderboardRank !== null) {
    for (const rank of [1, 2, 3, 5]) {
      if (leaderboardRank <= rank) candidateIds.add(`top_${rank}`)
    }
  }

  return [...candidateIds]
}
