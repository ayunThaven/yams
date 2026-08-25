import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/backofficeAuth'

export async function GET(request: NextRequest) {
  const auth = await requireBackoffice(request)
  if (auth.response) return auth.response
  return NextResponse.json({ user: auth.user }, { headers: { 'Cache-Control': 'no-store' } })
}

