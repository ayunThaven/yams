import { NextRequest, NextResponse } from 'next/server'
import { BACKOFFICE_SESSION_COOKIE, backofficeCookieOptions, hiddenNotFound, requireBackofficeGate, verifySameOrigin } from '@/lib/backofficeAuth'

export async function POST(request: NextRequest) {
  if (!(await requireBackofficeGate(request))) return hiddenNotFound()
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BACKOFFICE_SESSION_COOKIE, '', backofficeCookieOptions(0))
  return response
}
