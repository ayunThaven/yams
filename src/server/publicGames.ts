export type PublicGame = { id: string; host: string; avatar?: string; players: number; maxPlayers: number; variant: string; createdAt: string }

export function sortPublicGames(games: PublicGame[]): PublicGame[] {
  return games.sort((a, b) => (a.maxPlayers - a.players) - (b.maxPlayers - b.players) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}
