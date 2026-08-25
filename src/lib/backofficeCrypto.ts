import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { generateSecret, generateURI, verify } from 'otplib'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashOpaqueToken(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function encryptionKey(): Buffer {
  const raw = process.env.BACKOFFICE_TOTP_ENCRYPTION_KEY
  if (!raw) throw new Error('BACKOFFICE_TOTP_ENCRYPTION_KEY manquant')
  const decoded = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (decoded.length !== 32) throw new Error('BACKOFFICE_TOTP_ENCRYPTION_KEY doit contenir 32 octets')
  return decoded
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((value) => value.toString('base64url')).join('.')
}

export function decryptTotpSecret(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Secret TOTP invalide')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function createTotpEnrollment(email: string) {
  const secret = generateSecret({ length: 20 })
  return { secret, uri: createTotpUri(email, secret) }
}

export function createTotpUri(email: string, secret: string) {
  return generateURI({ issuer: 'Yams Back-office', label: email, secret })
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false
  const result = await verify({ secret, token, epochTolerance: 30 })
  return result.valid
}

export function createRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(6).toString('hex').toUpperCase())
}
