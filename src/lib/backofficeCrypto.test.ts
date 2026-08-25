import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generate } from 'otplib'
import {
  createRecoveryCodes,
  createTotpEnrollment,
  decryptTotpSecret,
  encryptTotpSecret,
  hashOpaqueToken,
  randomToken,
  verifyTotp,
} from './backofficeCrypto'

describe('backofficeCrypto', () => {
  it('génère des jetons opaques de 256 bits et des empreintes stables', () => {
    const first = randomToken()
    const second = randomToken()
    assert.notEqual(first, second)
    assert.ok(Buffer.from(first, 'base64url').length >= 32)
    assert.equal(hashOpaqueToken(first), hashOpaqueToken(first))
    assert.notEqual(hashOpaqueToken(first), hashOpaqueToken(second))
  })

  it('chiffre les secrets TOTP avec une clé distincte', () => {
    const previous = process.env.BACKOFFICE_TOTP_ENCRYPTION_KEY
    process.env.BACKOFFICE_TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    try {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP')
      assert.notEqual(encrypted, 'JBSWY3DPEHPK3PXP')
      assert.equal(decryptTotpSecret(encrypted), 'JBSWY3DPEHPK3PXP')
    } finally {
      if (previous === undefined) delete process.env.BACKOFFICE_TOTP_ENCRYPTION_KEY
      else process.env.BACKOFFICE_TOTP_ENCRYPTION_KEY = previous
    }
  })

  it('valide un code TOTP et produit des codes de récupération uniques', async () => {
    const enrollment = createTotpEnrollment('ops@example.com')
    const token = await generate({ secret: enrollment.secret })
    assert.equal(await verifyTotp(enrollment.secret, token), true)
    assert.equal(await verifyTotp(enrollment.secret, '00000'), false)
    const codes = createRecoveryCodes()
    assert.equal(codes.length, 8)
    assert.equal(new Set(codes).size, codes.length)
  })
})
