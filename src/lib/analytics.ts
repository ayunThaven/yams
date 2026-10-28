import type { GameEndReason, GameVariant, MatchType, GameVisibility } from '@/types/game'

/** Product events are intentionally provider-independent in phase 0. */
export type ProductEventPayloads = {
  guest_session_created: { guestSessionId: string }
  game_created: { gameId: string; variant: GameVariant; visibility: GameVisibility; matchType: MatchType }
  game_joined: { gameId: string; playerKind: 'USER' | 'GUEST' }
  game_started: { gameId: string; playerCount: number }
  game_completed: { gameId: string; reason: GameEndReason }
  account_created: { userId: string }
  guest_converted: { guestSessionId: string; userId: string }
  quick_play_started: { playerKind: 'USER' | 'GUEST' }
  ranked_game_started: { gameId: string }
  ranked_game_completed: { gameId: string }
}

export function trackEvent<Name extends keyof ProductEventPayloads>(
  name: Name,
  payload: ProductEventPayloads[Name]
): void {
  // Phase 0: connect a provider here later, not at each business call site.
  void name
  void payload
}
