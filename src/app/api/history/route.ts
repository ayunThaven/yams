import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyJwtToken } from '@/lib/authServer'
import { SimpleCache } from '@/lib/simpleCache'

const COOKIE_NAME = 'yams_auth_token'

// Cache process-local pour l'historique récent d'un utilisateur.
type HistoryGame = {
  id: string
  owner: string | null
  status: string
  created_at: string
  winner: string | null
  players_scores: unknown
  variant: string | null
}

type HistoryResultRow = {
  score: number
  abandoned: boolean
  finalized_at: string
  games: HistoryGame | HistoryGame[] | null
}

const historyCache = new SimpleCache<HistoryGame[]>(30_000) // 30 secondes

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const authUser = token ? verifyJwtToken(token) : null

  if (!authUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const userId = authUser.id
  const cacheKey = `history_${userId}`
  const cached = historyCache.get(cacheKey)

  if (cached) {
    return NextResponse.json({ data: cached }, { status: 200 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Base de données indisponible.' },
      { status: 500 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('game_results')
      .select('score, abandoned, finalized_at, games!inner(id, owner, status, created_at, winner, players_scores, variant)')
      .eq('user_id', userId)
      .order('finalized_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[API/HISTORY] Erreur chargement games:', error)
      return NextResponse.json(
        { error: 'Erreur lors du chargement de l’historique.' },
        { status: 500 }
      )
    }

    const myGames = ((data ?? []) as unknown as HistoryResultRow[])
      .flatMap((result) => {
        const game = Array.isArray(result.games) ? result.games[0] : result.games
        return game ? [game] : []
      })

    historyCache.set(cacheKey, myGames)

    return NextResponse.json({ data: myGames }, { status: 200 })
  } catch (error) {
    console.error('[API/HISTORY] Exception:', error)
    return NextResponse.json(
      { error: 'Erreur inattendue lors du chargement de l’historique.' },
      { status: 500 }
    )
  }
}

