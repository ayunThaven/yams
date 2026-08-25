import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

import { middleware } from '../../middleware'
import {
  BACKOFFICE_SESSION_SECONDS,
  backofficeCookieOptions,
  createSessionToken,
} from './backofficeAuth'

describe('backoffice access isolation', () => {
  const previousJwtSecret = process.env.BACKOFFICE_JWT_SECRET

  before(() => { process.env.BACKOFFICE_JWT_SECRET = 'test-only-backoffice-secret-at-least-32-bytes' })
  after(() => {
    if (previousJwtSecret === undefined) delete process.env.BACKOFFICE_JWT_SECRET
    else process.env.BACKOFFICE_JWT_SECRET = previousJwtSecret
  })

  for (const pathname of ['/backoffice', '/backoffice/login', '/api/backoffice/players']) {
    it(`masque ${pathname} sans appareil, même avec une session joueur`, async () => {
      const request = new NextRequest(`https://example.test${pathname}`, {
        headers: { cookie: 'yams_auth_token=player-session' },
      })
      const response = await middleware(request)
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(await response.text(), 'Not Found')
    })
  }

  it('crée une session BO distincte de deux heures avec un cookie strict', () => {
    const token = createSessionToken({
      sub: '9f18897f-fb38-4674-b168-d726fc9be3a3',
      email: 'admin@example.test',
      role: 'admin',
      sessionVersion: 1,
    })
    const payload = jwt.decode(token) as { kind?: string; exp?: number; iat?: number }
    assert.equal(payload.kind, 'backoffice-session')
    assert.ok(payload.exp && payload.iat)
    assert.equal(payload.exp! - payload.iat!, BACKOFFICE_SESSION_SECONDS)
    assert.deepEqual(backofficeCookieOptions(BACKOFFICE_SESSION_SECONDS), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: BACKOFFICE_SESSION_SECONDS,
    })
  })
})
