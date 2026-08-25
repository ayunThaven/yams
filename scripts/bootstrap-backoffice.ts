import 'dotenv/config'
import { createAdminClient } from '../src/lib/supabase/admin'
import { hashOpaqueToken, randomToken } from '../src/lib/backofficeCrypto'
import { sendBackofficeAccessEmail } from '../src/lib/emailSender'

async function main() {
  const emailArg = process.argv.find((value) => value.startsWith('--email='))?.slice('--email='.length)
  const baseUrlArg = process.argv.find((value) => value.startsWith('--base-url='))?.slice('--base-url='.length)
  const printLink = process.argv.includes('--print-link')
  const email = emailArg?.trim().toLowerCase()
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Usage: npm run backoffice:bootstrap -- --email=admin@example.com [--base-url=http://localhost:3000]')
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Configuration Supabase manquante')
  const { count } = await supabase.from('backoffice_users').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) throw new Error('Un compte back-office existe déjà; utilisez la gestion d’équipe.')

  const invitationToken = randomToken(32)
  const accessToken = randomToken(32)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data: invitation, error } = await supabase.from('backoffice_invitations').insert({
    email, role: 'admin', token_hash: hashOpaqueToken(invitationToken), expires_at: expiresAt,
  }).select('id').single()
  if (error || !invitation) throw new Error(error?.message ?? 'Invitation impossible')
  const { error: linkError } = await supabase.from('backoffice_access_links').insert({
    invitation_id: invitation.id, token_hash: hashOpaqueToken(accessToken), expires_at: expiresAt,
  })
  if (linkError) throw new Error(linkError.message)
  const configuredBaseUrl = baseUrlArg || process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  let baseUrl: string
  try { baseUrl = new URL(configuredBaseUrl).origin } catch { throw new Error('base-url invalide') }
  const url = `${baseUrl}/api/private-access/${encodeURIComponent(accessToken)}?invite=${encodeURIComponent(invitationToken)}`
  if (printLink) {
    console.log(`Invitation locale créée pour ${email}. Elle expire le ${expiresAt}.`)
    console.log(url)
    return
  }
  await sendBackofficeAccessEmail({ to: email, accessUrl: url })
  console.log(`Invitation envoyée à ${email}. Elle expire le ${expiresAt}.`)
  if (!process.env.SENDGRID_API_KEY) console.log(url)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
