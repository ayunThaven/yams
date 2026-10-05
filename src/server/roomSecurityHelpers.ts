/**
 * Helpers pour les vérifications de sécurité des rooms
 * Sépare la logique de validation pour améliorer la lisibilité
 */

import { matchesIdentity } from '@/lib/playerIdentity'
import type { PlayerIdentity } from '@/types/game'
import { Socket, Server } from 'socket.io'
import { SupabaseClient } from '@supabase/supabase-js'
import { getGameState } from './gameStateManager'

type Player = { id: string; name: string; userId?: string; guestSessionId?: string; avatar?: string }

/**
 * Vérifie que la partie existe dans la base de données
 */
export async function verifyGameExists(
  supabase: SupabaseClient,
  roomId: string,
  socket: Socket
): Promise<boolean> {
  try {
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('id, status')
      .eq('id', roomId)
      .single()

    if (gameError || !gameData) {
      socket.emit('game_not_found', { 
        message: 'Cette partie n\'existe pas ou a été supprimée.' 
      })
      return false
    }

    // Même si la partie est terminée en base (status = finished),
    // on autorise la connexion pour afficher l'écran de résultats.
    // Les règles côté client (GamePage) gèrent l'affichage de GameOver.
    return true
  } catch (err) {
    console.error('[ROOM] Erreur lors de la vérification de la partie:', err)
    socket.emit('error', { message: 'Erreur lors de la vérification de la partie' })
    return false
  }
}

/**
 * Vérifie qu'un utilisateur ne rejoint pas une partie où il est déjà présent (waiting room)
 */
export function verifyNotAlreadyInWaitingRoom(
  io: Server,
  roomId: string,
  identity: PlayerIdentity,
  socketId: string,
  socket: Socket,
  getPlayersInRoom: (io: Server, roomId: string) => Player[]
): boolean {
  const existingPlayers = getPlayersInRoom(io, roomId)
  const alreadyInRoom = existingPlayers.some(player => 
    matchesIdentity(player, identity) && player.id !== socketId
  )
  
  if (alreadyInRoom) {
    socket.emit('error', { 
      message: 'Vous êtes déjà dans cette partie. Vous ne pouvez pas jouer contre vous-même.' 
    })
    setTimeout(() => {
      socket.disconnect()
    }, 100)
    return false
  }

  return true
}

/**
 * Vérifie qu'un utilisateur peut rejoindre une partie en cours (reconnexion légitime)
 */
export function verifyCanReconnectToGame(
  roomId: string,
  identity: PlayerIdentity,
  socket: Socket
): boolean {
  const gameState = getGameState(roomId)
  if (!gameState) return false

  const isPlayerInGame = gameState.players.some(p => matchesIdentity(p, identity))
  if (!isPlayerInGame) {
    socket.emit('error', { 
      message: 'Vous ne pouvez pas rejoindre cette partie en cours.' 
    })
    setTimeout(() => {
      socket.disconnect()
    }, 100)
    return false
  }

  return true
}

/**
 * Récupère l'avatar d'un utilisateur depuis la base de données
 */
export async function fetchUserAvatar(
  supabase: SupabaseClient,
  userId: string
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    if (!error && data) {
      return data.avatar_url
    }
  } catch (err) {
    console.error('[ROOM] Erreur lors de la récupération de l\'avatar:', err)
  }
  return undefined
}

