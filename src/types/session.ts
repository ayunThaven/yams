import type { UserProfile } from './user'

export type ClientAuthUser = { id: string; email?: string }
export type GuestClientSession = { guestSessionId: string; nickname: string; expiresAt: string }
export type ClientSession =
  | { kind: 'USER'; user: ClientAuthUser; profile: UserProfile | null }
  | ({ kind: 'GUEST' } & GuestClientSession)
  | { kind: 'NONE' }
