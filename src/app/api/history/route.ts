import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SimpleCache } from '@/lib/simpleCache'
import { requireAuth } from '@/lib/authRequest'

// Cache process-local pour l'historique récent d'un utilisateur.
type HistoryPlayerScore = {
  id?: string
  name?: string
  user_id?: string
  score?: number
  abandoned?: boolean
}

type HistoryGameRow = {
  id: string
  owner: string | null
  status: string
  created_at: string
  winner: string | null
  players_scores: HistoryPlayerScore[] | null
  variant: string | null
}

const historyCache = new SimpleCache<HistoryGameRow[]>(30_000) // 30 secondes

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth.response) return auth.response

  const userId = auth.user.id
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
      .from('games')
      .select('id, owner, status, created_at, winner, players_scores, variant')
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[API/HISTORY] Erreur chargement games:', error)
      return NextResponse.json(
        { error: 'Erreur lors du chargement de l’historique.' },
        { status: 500 }
      )
    }

    const myGames = ((data || []) as HistoryGameRow[])
      .filter((game) => {
        if (game.owner === userId) return true
        if (game.players_scores && Array.isArray(game.players_scores)) {
          return game.players_scores.some((p) => p.user_id === userId)
        }
        return false
      })
      .slice(0, 10)

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

