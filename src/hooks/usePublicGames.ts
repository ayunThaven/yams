import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import type { GameVariant } from '@/types/game'

export type PublicGame = { id: string; host: string; avatar?: string; players: number; maxPlayers: number; variant: GameVariant }

export function usePublicGames(enabled: boolean) {
  const [games, setGames] = useState<PublicGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    const socket = io({ path: '/api/socket' })
    let active = true
    let inFlight = false
    let pending = false
    const refresh = () => {
      if (!socket.connected) return
      if (inFlight) { pending = true; return }
      inFlight = true
      socket.timeout(8000).emit('list_public_games', (err: Error | null, result?: { games?: PublicGame[]; error?: string }) => {
        inFlight = false
        if (!active) return
        if (!pending) {
          setLoading(false)
          if (err || result?.error || !result?.games) setError(result?.error || 'Impossible de charger les parties publiques.')
          else { setError(''); setGames(result.games) }
        }
        if (pending) { pending = false; refresh() }
      })
    }
    socket.on('connect', refresh)
    socket.on('public_games_changed', refresh)
    socket.on('connect_error', () => { setLoading(false); setError('Connexion aux parties indisponible.') })
    const timer = setInterval(() => { if (socket.connected) refresh() }, 10000)
    return () => { active = false; clearInterval(timer); socket.disconnect() }
  }, [enabled])
  return { games, loading, error }
}
