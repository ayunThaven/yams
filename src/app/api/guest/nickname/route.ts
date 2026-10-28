import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowAuthAttempt } from '@/lib/authRateLimit'
import { validateGuestNickname } from '@/lib/guestSession'
import { isGuestNicknameAvailable, RESERVED_NICKNAME_MESSAGE } from '@/lib/guestNickname'
import { isSameSiteOrigin } from '@/lib/requestOrigin'

export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  try {
    if (!isSameSiteOrigin(request.headers.get('origin'), request.headers.get('host') || request.nextUrl.host)) return reply({ error: 'Origine refusée.' }, 403)
    const body = await request.json().catch(() => null)
    const nickname = validateGuestNickname(body?.nickname)
    if (!nickname) return reply({ available: false, error: 'Choisissez un pseudo de 1 à 32 caractères, sans caractères de contrôle.' }, 400)
    const limit = await allowAuthAttempt(request, 'guest-nickname')
    if (limit !== 'allowed') return reply({ error: limit === 'limited' ? 'Trop de vérifications. Réessayez plus tard.' : 'Vérification temporairement indisponible.' }, limit === 'limited' ? 429 : 503)
    const supabase = createAdminClient()
    if (!supabase) throw new Error('Base de données indisponible')
    const available = await isGuestNicknameAvailable(supabase, nickname)
    return reply({ available, ...(available ? {} : { error: RESERVED_NICKNAME_MESSAGE }) })
  } catch { return reply({ error: 'Vérification temporairement indisponible. Modifiez le pseudo pour réessayer.' }, 503) }
}
