import type { GameVariant, ScoreCategory } from '@/types/game'

export const GAME_VARIANTS = ['classic', 'descending', 'ascending'] as const

export const SCORE_CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'threeOfKind',
  'fourOfKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yams',
  'chance',
] as const

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

// These parsers sit on API and Socket.IO boundaries. TypeScript types do not
// protect runtime payloads, so callers should reject null before touching state.
export function isGameVariant(value: unknown): value is GameVariant {
  return typeof value === 'string' && GAME_VARIANTS.includes(value as GameVariant)
}

export function isScoreCategory(value: unknown): value is ScoreCategory {
  return typeof value === 'string' && SCORE_CATEGORIES.includes(value as ScoreCategory)
}

export function parseRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const roomId = value.trim()
  if (!ROOM_ID_PATTERN.test(roomId)) return null

  return roomId
}

export function parseDieIndex(value: unknown): number | null {
  if (!Number.isInteger(value)) return null

  const dieIndex = Number(value)
  return dieIndex >= 0 && dieIndex < 5 ? dieIndex : null
}

export function parseMaxPlayers(value: unknown): number | null {
  if (!Number.isInteger(value)) return null

  const maxPlayers = Number(value)
  return maxPlayers >= 2 && maxPlayers <= 8 ? maxPlayers : null
}

export function parseCreateGameBody(body: unknown): {
  id?: string
  variant: GameVariant
} | null {
  if (!body || typeof body !== 'object') return null

  const data = body as { id?: unknown; variant?: unknown }
  if (!isGameVariant(data.variant)) return null

  const id = data.id === undefined ? undefined : parseRoomId(data.id)
  if (data.id !== undefined && !id) return null

  return {
    id: id || undefined,
    variant: data.variant,
  }
}
