/** One global competitive rating per authenticated user. */
export type UserRating = {
  userId: string
  mu: number
  sigma: number
  gamesPlayed: number
  wins: number
  createdAt: string
  updatedAt: string
}

export type RatingHistoryEntry = {
  gameId: string
  userId: string
  position: number
  playerCount: number
  muBefore: number
  sigmaBefore: number
  muAfter: number
  sigmaAfter: number
  createdAt: string
}

/** Future OpenSkill input: ordered positions, with equal positions for ties. */
export type RankedPlacement = { userId: string; position: number }
