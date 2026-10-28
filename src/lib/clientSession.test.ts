import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchClientSession } from './clientSession'

test('client session resolves anonymous 200 auth responses as GUEST or NONE; USER takes precedence', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let auth: object = { user: null, profile: null }
  let guestStatus = 200
  let guestCalls = 0
  globalThis.fetch = (async url => {
    if (url === '/api/auth/me') return Response.json(auth)
    guestCalls++
    return Response.json({ session: { guestSessionId: 'guest-id', nickname: 'Élodie', expiresAt: 'tomorrow' } }, { status: guestStatus })
  }) as typeof fetch
  assert.equal((await fetchClientSession()).kind, 'GUEST')
  guestStatus = 401
  assert.equal((await fetchClientSession()).kind, 'NONE')
  auth = { user: { id: 'user-id' }, profile: null }
  assert.equal((await fetchClientSession()).kind, 'USER')
  assert.equal(guestCalls, 2)
})
