import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Achievement } from '@/types/achievement'

type AchievementWithStatus = {
  id: string
  achievement: Achievement
  unlocked_at: string | null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const searchParams = request.nextUrl.searchParams
  const showAll = searchParams.get('all') === '1'

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Base de données indisponible.' },
      { status: 500 }
    )
  }

  try {
    // 1) Derniers succès débloqués uniquement
    if (!showAll) {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(
          `
          id,
          unlocked_at,
          achievement:achievements (
            id,
            name,
            description,
            image_path,
            rarity,
            category,
            created_at
          )
        `
        )
        .eq('user_id', id)
        .order('unlocked_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('[API/USER ACHIEVEMENTS] Erreur chargement achievements:', error)
        return NextResponse.json(
          { error: 'Impossible de charger les achievements.' },
          { status: 500 }
        )
      }

      const achievements = (data ?? []) as unknown as AchievementWithStatus[]
      return NextResponse.json({ data: achievements }, { status: 200 })
    }

    // 2) Liste complète : tous les succès existants + info de déblocage pour cet utilisateur
    const [{ data: allAchievements, error: achievementsError }, { data: unlockedRows, error: unlockedError }] =
      await Promise.all([
        supabase
          .from('achievements_with_rarity_rank')
          .select('*')
          .order('rarity_rank', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('user_achievements')
          .select('id, achievement_id, unlocked_at')
          .eq('user_id', id),
      ])

    if (achievementsError || unlockedError) {
      console.error('[API/USER ACHIEVEMENTS] Erreur chargement liste complète:', {
        achievementsError,
        unlockedError,
      })
      return NextResponse.json(
        { error: 'Impossible de charger la liste complète des achievements.' },
        { status: 500 }
      )
    }

    const unlockedMap = new Map<string, { id: string; unlocked_at: string }>()
    for (const row of unlockedRows || []) {
      unlockedMap.set(row.achievement_id as string, {
        id: row.id as string,
        unlocked_at: row.unlocked_at as string,
      })
    }

    const achievements: AchievementWithStatus[] = (allAchievements || []).map((achievement) => {
      const status = unlockedMap.get(achievement.id as string)
      return {
        id: status?.id ?? `locked-${achievement.id}`,
        achievement: achievement as Achievement,
        unlocked_at: status?.unlocked_at ?? null,
      }
    })

    return NextResponse.json({ data: achievements }, { status: 200 })
  } catch (error) {
    console.error('[API/USER ACHIEVEMENTS] Exception:', error)
    return NextResponse.json(
      { error: 'Erreur inattendue lors du chargement des achievements.' },
      { status: 500 }
    )
  }
}


