import type { ClientSession } from '@/types/session'

export async function fetchClientSession(): Promise<ClientSession> {
  const authResponse = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
  if (!authResponse.ok) throw new Error('Session utilisateur indisponible')
  const auth = await authResponse.json()
  if (auth.user) return { kind: 'USER', user: auth.user, profile: auth.profile }

  // auth/me deliberately responds 200 with user:null to anonymous browsers.
  const guestResponse = await fetch('/api/guest/session', { credentials: 'include', cache: 'no-store' })
  if (guestResponse.status === 401) return { kind: 'NONE' }
  if (!guestResponse.ok) throw new Error('Session invitée indisponible')
  const guest = await guestResponse.json()
  return guest.session ? { kind: 'GUEST', ...guest.session } : { kind: 'NONE' }
}
