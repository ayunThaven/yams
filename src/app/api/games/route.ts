import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyJwtToken } from '@/lib/authServer'
import { generateGameId } from '@/lib/gameIdGenerator'
import { unlockActionAchievement } from '@/server/gameFinalization'

const COOKIE_NAME = 'yams_auth_token'
const GAME_ID = /^[A-HJ-NP-Z2-9]{8}$/
const VARIANTS = new Set(['classic', 'ascending', 'descending'])

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value

    const authUser = token ? verifyJwtToken(token) : null
    if (!authUser) {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { variant, id: providedId } = body as {
      variant?: string
      id?: string
    }

    if (!variant || !VARIANTS.has(variant)) {
      return NextResponse.json(
        { error: 'La variante de jeu est invalide.' },
        { status: 400 }
      )
    }

    if (providedId && !GAME_ID.test(providedId)) {
      return NextResponse.json({ error: 'Identifiant de partie invalide.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Base de données indisponible.' },
        { status: 500 }
      )
    }

    const id = providedId || generateGameId()

    const { data, error } = await supabase
      .from('games')
      .insert([
        {
          id,
          status: 'waiting',
          owner: authUser.id,
          variant,
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

    // All current games are private and can only be joined with their code.
    await Promise.all([
      unlockActionAchievement(supabase, authUser.id, 'create_game'),
      unlockActionAchievement(supabase, authUser.id, 'create_private_game'),
    ])

    return NextResponse.json(
      {
        game: data,
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


