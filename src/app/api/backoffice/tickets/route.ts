import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1); const status = request.nextUrl.searchParams.get('status'); const priority = request.nextUrl.searchParams.get('priority'); const from = (page - 1) * 25
  let query = supabase.from('bug_tickets').select('*, reporter:users(id,username,avatar_url)', { count: 'exact' }).order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status); if (priority) query = query.eq('priority', priority)
  const { data, error, count } = await query.range(from, from + 24)
  if (error) return NextResponse.json({ error: 'Chargement impossible.' }, { status: 500 })
  return NextResponse.json({ data, page, total: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

