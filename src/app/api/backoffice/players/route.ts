import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1); const q = (request.nextUrl.searchParams.get('q') || '').trim(); const from = (page - 1) * 25
  let ids: string[] | null = null
  if (q.includes('@')) {
    const { data } = await supabase.from('auth_local_users').select('id').ilike('email', `%${q}%`).limit(100)
    ids = (data ?? []).map((row) => row.id)
    if (ids.length === 0) return NextResponse.json({ data: [], page, total: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }
  let query = supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (ids) query = query.in('id', ids); else if (q) query = query.ilike('username', `%${q}%`)
  const { data, error, count } = await query.range(from, from + 24)
  if (error) return NextResponse.json({ error: 'Recherche impossible.' }, { status: 500 })
  const userIds = (data ?? []).map((row) => row.id)
  const { data: emails } = userIds.length ? await supabase.from('auth_local_users').select('id, email').in('id', userIds) : { data: [] }
  const emailMap = new Map((emails ?? []).map((row) => [row.id, row.email]))
  return NextResponse.json({ data: (data ?? []).map((row) => ({ ...row, email: emailMap.get(row.id) })), page, total: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

