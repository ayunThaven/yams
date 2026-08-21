import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateGameId } from '@/lib/gameIdGenerator'
import { requireAuth } from '@/lib/authRequest'
import { parseCreateGameBody } from '@/lib/validation'
import { unlockAchievementsForUser } from '@/server/achievementService'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    const parsedBody = parseCreateGameBody(body)

    if (!parsedBody) {
      return NextResponse.json(
        { error: 'Payload de création de partie invalide.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Base de données indisponible.' },
        { status: 500 }
      )
    }

    const id = parsedBody.id || generateGameId()

    const { data, error } = await supabase
      .from('games')
      .insert([
        {
          id,
          status: 'waiting',
          owner: auth.user.id,
          variant: parsedBody.variant,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('[API/GAMES] Erreur insertion:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la création de la partie.' },
        { status: 500 }
      )
    }

    const achievements = await unlockAchievementsForUser(supabase, auth.user.id, ['create_game'])

    return NextResponse.json(
      {
        game: data,
        achievements,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API/GAMES] Exception:', error)
    return NextResponse.json(
      { error: 'Erreur inattendue lors de la création de la partie.' },
      { status: 500 }
    )
  }
}


