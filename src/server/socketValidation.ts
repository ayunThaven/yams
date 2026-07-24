import { ScoreCategory } from '@/types/game'

const ROOM_ID = /^[A-HJ-NP-Z2-9]{8}$/

const SCORE_CATEGORIES = new Set<ScoreCategory>([
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'threeOfKind', 'fourOfKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yams', 'chance',
])

export function isValidRoomId(value: unknown): value is string {
  return typeof value === 'string' && ROOM_ID.test(value)
}

export function isValidDieIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 5
}

export function isScoreCategory(value: unknown): value is ScoreCategory {
  return typeof value === 'string' && SCORE_CATEGORIES.has(value as ScoreCategory)
}
