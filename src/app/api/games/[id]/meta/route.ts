import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/server/playerIdentity'
import { isGameOwner } from '@/lib/playerIdentity'
import { isValidRoomId } from '@/server/socketValidation'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  if (!isValidRoomId(id)) return NextResponse.json({ error: 'Code invalide.' }, { status: 400 })

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Base de données indisponible.' },
      { status: 500 }
    )
  }

  try {
    const identity = await resolveRequestIdentity(request.cookies, supabase)
    if (!identity) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
    const { data, error } = await supabase
      .from('games')
      .select('id, status, variant, owner, guest_owner_session_id, max_players, visibility, match_type')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Partie introuvable.', data: null },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: { id: data.id, status: data.status, variant: data.variant, max_players: data.max_players, isHost: isGameOwner(data, identity) } }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[API/GAME META] Exception:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de la partie.', data: null },
      { status: 500 }
    )
  }
}


