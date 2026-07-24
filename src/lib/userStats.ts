import { ScoreSheet } from '@/types/game'
import { LEVELING_BASE, LEVELING_GROWTH } from './levelingConfig'

export function xpForLevel(level: number): number {
  if (level <= 0) return 0
  return Math.floor(
    LEVELING_BASE * ((Math.pow(LEVELING_GROWTH, level + 1) - 1) / (LEVELING_GROWTH - 1))
  )
}

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1

  let level = 1
  while (level < 50 && xpForLevel(level + 1) <= xp) {
    level++
  }
  return level
}

export function countYamsInScoreSheet(scoreSheet: ScoreSheet): number {
  return scoreSheet.yams === 50 ? 1 : 0
}
