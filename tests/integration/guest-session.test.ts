import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import type { Socket } from 'socket.io'
import { POST, GET, DELETE } from '@/app/api/guest/session/route'
import { POST as checkNickname } from '@/app/api/guest/nickname/route'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as createGame } from '@/app/api/games/route'
import { GUEST_COOKIE_NAME, GUEST_SESSION_SECONDS, guestCookieOptions, signGuestToken, validateGuestNickname, verifyGuestToken } from '@/lib/guestSession'
import { generateJwt, hashPassword, verifyJwtToken } from '@/lib/authServer'
import { resolveRequestIdentity } from '@/server/playerIdentity'
import { createAuthMiddleware } from '@/server/socketAuthMiddleware'
import { middleware } from '../../middleware'

test('guest API, HTTP and socket identity security', async t => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }
  Object.assign(process.env, { SUPABASE_URL: 'http://guest-tests.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', AUTH_JWT_SECRET: 'test-user-secret', GUEST_JWT_SECRET: 'test-guest-secret' })
  const sessions = new Map<string, { id: string; nickname: string; expires_at: string; created_at: string }>()
  const games: Record<string, unknown>[] = []
  const achievementUsers: string[] = []
  const passwordHash = await hashPassword('test-password-123')
  let limited = false
  let unavailable = false
  let accountLookupUnavailable = false
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    assert.equal(url.hostname, 'guest-tests.invalid')
    const body = init?.body ? JSON.parse(String(init.body)) : null
    let data: unknown = null
    if (url.pathname.endsWith('/rpc/consume_auth_rate_limit')) {
      if (unavailable) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 })
      data = !limited
    } else if (url.pathname.endsWith('/rpc/unlock_achievement')) {
      achievementUsers.push(body.p_user_id); data = false
    } else if (url.pathname.endsWith('/guest_sessions')) {
      if (init?.method === 'POST') {
        const row = { id: randomUUID(), ...body }; sessions.set(row.id, row); data = row
      } else if (init?.method === 'PATCH') data = null
      else data = sessions.get(url.searchParams.get('id')?.slice(3) || '') || null
    } else if (url.pathname.endsWith('/auth_local_users')) data = { id: 'user-login-id', email: 'alice@example.test', password_hash: passwordHash, email_verified: true }
    else if (url.pathname.endsWith('/users')) {
      const nicknameFilter = url.searchParams.get('username')
      if (nicknameFilter) {
        if (accountLookupUnavailable) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 })
        data = nicknameFilter.toLowerCase() === 'ilike.alice' ? [{ id: 'account-alice' }] : []
      } else data = { username: 'Alice' }
    }
    else if (url.pathname.endsWith('/games')) { const row = Array.isArray(body) ? body[0] : body; games.push(row); data = row }
    else throw new Error(`Unexpected request ${url.pathname}`)
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  t.after(() => { globalThis.fetch = originalFetch; process.env = originalEnv })
  const request = (method: string, body?: unknown, cookie = '', path = '/api/guest/session') => new NextRequest(`http://localhost${path}`, {
    method, headers: { cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let cookie = ''
  let id = ''
  await t.test('nickname preview creates no session and checks availability before play', async () => {
    const check = (nickname: string) => checkNickname(request('POST', { nickname }, '', '/api/guest/nickname'))
    assert.deepEqual(await (await check('Alice')).json(), { available: false, error: 'Ce pseudo est déjà utilisé par un compte. Choisissez-en un autre ou connectez-vous.' })
    assert.equal((await (await check('ALICE')).json()).available, false)
    assert.equal((await (await check('Élodie')).json()).available, true)
    assert.equal((await check('')).status, 400)
    accountLookupUnavailable = true
    assert.equal((await check('Élodie')).status, 503)
    accountLookupUnavailable = false
    limited = true
    assert.equal((await check('Élodie')).status, 429)
    limited = false
    assert.equal(sessions.size, 0)
    assert.equal(games.length, 0)
  })
  await t.test('account nicknames are reserved case-insensitively; lookup failures prevent insertion', async () => {
    for (const nickname of ['Alice', ' alice ', 'ALICE']) {
      const response = await POST(request('POST', { nickname }))
      assert.equal(response.status, 409)
      assert.match((await response.json()).error, /déjà utilisé par un compte/)
    }
    accountLookupUnavailable = true
    assert.equal((await POST(request('POST', { nickname: 'Available' }))).status, 503)
    accountLookupUnavailable = false
    assert.equal(sessions.size, 0)
  })
  await t.test('valid Unicode nickname, server ID, signed HTTP-only cookie, fixed 24h', async () => {
    const response = await POST(request('POST', { nickname: '  Élodie  ', guestSessionId: 'attacker-chosen-id' }))
    assert.equal(response.status, 201)
    const { session } = await response.json()
    id = session.guestSessionId
    assert.notEqual(id, 'attacker-chosen-id')
    assert.equal(session.nickname, 'Élodie')
    const stored = sessions.get(id)!
    assert.equal(Date.parse(stored.expires_at) - Date.parse(stored.created_at), GUEST_SESSION_SECONDS * 1000)
    const header = response.headers.get('set-cookie')!
    assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i); assert.match(header, /Path=\//i)
    cookie = `${GUEST_COOKIE_NAME}=${response.cookies.get(GUEST_COOKIE_NAME)!.value}`
    const decoded = jwt.decode(response.cookies.get(GUEST_COOKIE_NAME)!.value)
    assert.equal(decoded.nickname, undefined)
    assert.equal(decoded.kind, 'GUEST')
  })
  await t.test('invalid nicknames cannot create rows', async () => {
    for (const nickname of ['', '   ', 'x'.repeat(33), 'Alice\n', 'A\u0000B', 42]) {
      assert.equal(validateGuestNickname(nickname), null)
      assert.equal((await POST(request('POST', { nickname }))).status, 400)
    }
    assert.equal(sessions.size, 1)
    assert.equal(validateGuestNickname('E\u0301lodie'), 'Élodie')
  })
  await t.test('GET validates DB expiration; no automatic renewal', async () => {
    const before = sessions.get(id)!.expires_at
    assert.equal((await GET(request('GET', undefined, cookie))).status, 200)
    assert.equal(sessions.get(id)!.expires_at, before)
    sessions.get(id)!.expires_at = new Date(Date.now() - 1000).toISOString()
    assert.equal((await GET(request('GET', undefined, cookie))).status, 401)
    sessions.get(id)!.expires_at = before
    assert.equal((await GET(request('GET', undefined, `${GUEST_COOKIE_NAME}=forged`))).status, 401)
  })
  const userToken = generateJwt({ id: randomUUID(), email: 'alice@example.test' }).token
  await t.test('USER has priority; token domains cannot be interchanged', async () => {
    const identity = await resolveRequestIdentity(request('GET', undefined, `${cookie}; yams_auth_token=${userToken}`).cookies)
    assert.equal(identity?.kind, 'USER')
    assert.equal(verifyGuestToken(userToken), null)
    assert.equal(verifyJwtToken(cookie.split('=')[1]), null)
    assert.equal((await POST(request('POST', { nickname: 'Guest' }, `yams_auth_token=${userToken}`))).status, 409)
  })
  await t.test('guest and user games impose PRIVATE/CASUAL and achievements only USER', async () => {
    for (const auth of [cookie, `yams_auth_token=${userToken}`]) {
      const response = await createGame(request('POST', { variant: 'classic', visibility: 'PUBLIC', match_type: 'RANKED' }, auth, '/api/games'))
      assert.equal(response.status, 201)
      const row = games.at(-1)!
      assert.equal(row.visibility, 'PRIVATE'); assert.equal(row.match_type, 'CASUAL')
      if (auth === cookie) { assert.equal(row.owner, null); assert.equal(row.guest_owner_session_id, id); assert.equal(achievementUsers.length, 0) }
      else { assert.equal(row.owner, jwt.decode(userToken).id); assert.equal(row.guest_owner_session_id, null); assert.equal(achievementUsers.length, 2) }
    }
    assert.equal((await createGame(request('POST', { variant: 'bad' }, cookie, '/api/games'))).status, 400)
  })
  await t.test('socket ignores client IDs; validates signed cookie and DB deadline', async () => {
    const authenticate = async (header: string, guestSessionId = id) => {
      const socket = { handshake: { auth: { guestSessionId }, headers: { cookie: header } }, data: {} } as unknown as Socket
      let error: Error | undefined
      await createAuthMiddleware('server-1')(socket, err => { error = err })
      return { socket, error }
    }
    const accepted = await authenticate(cookie, 'someone-else')
    assert.equal(accepted.error, undefined)
    assert.equal(accepted.socket.data.identity?.kind, 'GUEST')
    assert.equal(accepted.socket.data.guestSessionId, id)
    assert.equal(accepted.socket.data.authenticated, false)
    assert.ok((await authenticate('')).error)
    assert.ok((await authenticate(`${GUEST_COOKIE_NAME}=forged`)).error)
    const expiredToken = signGuestToken({ id, nickname: 'Élodie', expires_at: new Date(Date.now() - 1000).toISOString() })
    assert.ok((await authenticate(`${GUEST_COOKIE_NAME}=${expiredToken}`)).error)
    const before = sessions.get(id)!.expires_at
    sessions.get(id)!.expires_at = new Date(Date.now() - 1000).toISOString()
    assert.ok((await authenticate(cookie)).error)
    sessions.get(id)!.expires_at = before
  })
  await t.test('DELETE clears browser cookie while preserving historical rows', async () => {
    const response = await DELETE(request('DELETE', undefined, cookie))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie')!, /Max-Age=0/)
    assert.equal(sessions.size, 1)
  })
  await t.test('successful account login clears guest cookie', async () => {
    const response = await login(request('POST', { email: 'alice@example.test', password: 'test-password-123' }, cookie, '/api/auth/login'))
    assert.equal(response.status, 200)
    assert.ok(response.cookies.get('yams_auth_token')?.value)
    assert.equal(response.cookies.get(GUEST_COOKIE_NAME)?.value, '')
    assert.equal(sessions.size, 1)
  })
  await t.test('cross-site guest mutations refused; production cookie always Secure', async () => {
    const crossSite = new NextRequest('http://localhost/api/guest/session', { method: 'POST', headers: { origin: 'https://attacker.test' }, body: JSON.stringify({ nickname: 'Alice' }) })
    assert.equal((await POST(crossSite)).status, 403)
    assert.equal((await DELETE(crossSite)).status, 403)
    const previous = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: 'production' })
    assert.equal(guestCookieOptions(new Date()).secure, true)
    Object.assign(process.env, { NODE_ENV: previous })
  })
  await t.test('rate limit and unavailable limiter fail closed', async () => {
    limited = true
    assert.equal((await POST(request('POST', { nickname: 'Guest' }))).status, 429)
    limited = false; unavailable = true
    assert.equal((await POST(request('POST', { nickname: 'Guest' }))).status, 503)
  })
  await t.test('link destination retained; guests excluded from dashboard', async () => {
    const response = await middleware(request('GET', undefined, '', '/game/ABCDEFGH'))
    assert.equal(response.headers.get('location'), 'http://localhost/play?join=ABCDEFGH')
    assert.equal((await middleware(request('GET', undefined, cookie, '/game/ABCDEFGH'))).status, 200)
    assert.match((await middleware(request('GET', undefined, cookie, '/dashboard'))).headers.get('location')!, /\/login/)
  })
})
