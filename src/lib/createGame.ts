import { api } from '@/lib/apiClient'
import { generateGameId } from '@/lib/gameIdGenerator'
import { GameVariant } from '@/types/game'
import { Achievement } from '@/types/achievement'

export async function createGame(
  variant: GameVariant
): Promise<{ id: string; error: string | null; achievements: Achievement[] }> {
  const id = generateGameId()
  const { data, error } = await api.post<{
    game: { id: string }
    achievements?: Achievement[]
  }>('/api/games', { id, variant })
  return { id, error, achievements: data?.achievements ?? [] }
}
