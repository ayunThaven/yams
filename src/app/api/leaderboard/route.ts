import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SimpleCache } from '@/lib/simpleCache'
import { getAuthUserFromRequest } from '@/lib/authRequest'

// Cache process-local pour le leaderboard.
// TTL court pour garder des données fraîches.
type LeaderboardRow = {
  id: string
  username: string
  avatar_url: string
  parties_jouees: number
  parties_gagnees: number
  parties_abandonnees: number
  meilleur_score: number
  nombre_yams_realises: number
  meilleure_serie_victoires: number
  serie_victoires_actuelle: number
  taux_victoire: number
  xp: number
  level: number
  created_at: string
  updated_at: string
}

const leaderboardCache = new SimpleCache<LeaderboardRow[]>(30_000) // 30 secondes

export async function GET(request: NextRequest) {
  const cacheKey = 'leaderboard_top_10'
  const cached = leaderboardCache.get(cacheKey)

  // Récupérer l'utilisateur connecté
  const authUser = getAuthUserFromRequest(request)
  const userId = authUser?.id

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Base de données indisponible.' },
      { status: 500 }
    )
  }

  try {
    // Récupérer le top 10
    let rows: LeaderboardRow[] = []
    if (cached) {
      rows = cached
    } else {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        // Ne garder que les joueurs avec au moins 5 parties jouées
        .gte('parties_jouees', 5)
        // Ordre de tri:
        // 1) pourcentage de victoire
        // 2) série de victoires actuelle
        // 3) nombre de parties jouées
        // 4) nombre de yams réalisés
        .order('taux_victoire', { ascending: false })
        .order('serie_victoires_actuelle', { ascending: false })
        .order('parties_jouees', { ascending: false })
        .order('nombre_yams_realises', { ascending: false })
        .limit(10)

      if (error) {
        console.error('[API/LEADERBOARD] Erreur:', error)
        return NextResponse.json(
          { error: 'Erreur lors du chargement du classement.' },
          { status: 500 }
        )
      }

      rows = (data || []) as LeaderboardRow[]
      leaderboardCache.set(cacheKey, rows)
    }

    // Vérifier si l'utilisateur est dans le top 10
    const userInTop10 = userId && rows.some((row) => row.id === userId)

    // Si l'utilisateur n'est pas dans le top 10 et qu'il a au moins 5 parties, calculer sa position
    let userRank: number | null = null
    let userData: LeaderboardRow | null = null

    if (userId && !userInTop10) {
      // Récupérer les stats du joueur
      const { data: userStats, error: userError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('id', userId)
        .gte('parties_jouees', 5)
        .maybeSingle()

      if (!userError && userStats) {
        userData = userStats as LeaderboardRow

        // Récupérer tous les joueurs triés pour trouver la position
        // Limité à 1000 pour éviter les performances trop lentes
        const { data: allPlayers, error: allError } = await supabase
          .from('leaderboard')
          .select('id,taux_victoire,serie_victoires_actuelle,parties_jouees,nombre_yams_realises')
          .gte('parties_jouees', 5)
          .order('taux_victoire', { ascending: false })
          .order('serie_victoires_actuelle', { ascending: false })
          .order('parties_jouees', { ascending: false })
          .order('nombre_yams_realises', { ascending: false })
          .limit(1000)

        if (!allError && allPlayers) {
          const index = allPlayers.findIndex((p) => p.id === userId)
          if (index !== -1) {
            userRank = index + 1
          }
        }
      }
    }

    return NextResponse.json(
      {
        data: rows,
        userRank: userRank || null,
        userData: userData || null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[API/LEADERBOARD] Exception:', error)
    return NextResponse.json(
      { error: 'Erreur inattendue lors du chargement du classement.' },
      { status: 500 }
    )
  }
}

