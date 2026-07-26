import { api } from '@/lib/apiClient'
import { generateGameId } from '@/lib/gameIdGenerator'
import { GameVariant } from '@/types/game'

export async function createGame(variant: GameVariant): Promise<{ id: string; error: string | null }> {
  const id = generateGameId()
  const { error } = await api.post<{ game: { id: string } }>('/api/games', { id, variant })
  return { id, error }
}
