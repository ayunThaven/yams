import type { PlayerIdentity } from '@/types/game'

export type IdentityFields = { userId?: string; guestSessionId?: string }

/** Also reads user-only snapshots written before Phase 1. */
export function getPlayerIdentity(player: IdentityFields): PlayerIdentity | null {
  if (player.userId) return { kind: 'USER', userId: player.userId }
  if (player.guestSessionId) return { kind: 'GUEST', guestSessionId: player.guestSessionId }
  return null
}

export function getIdentityKey(identity: PlayerIdentity): string {
  return identity.kind === 'USER' ? `USER:${identity.userId}` : `GUEST:${identity.guestSessionId}`
}

export function matchesIdentity(player: IdentityFields, identity: PlayerIdentity): boolean {
  const candidate = getPlayerIdentity(player)
  return !!candidate && getIdentityKey(candidate) === getIdentityKey(identity)
}

export function isGameOwner(game: { owner: string | null; guest_owner_session_id?: string | null }, identity: PlayerIdentity): boolean {
  return identity.kind === 'USER' ? game.owner === identity.userId : game.guest_owner_session_id === identity.guestSessionId
}
