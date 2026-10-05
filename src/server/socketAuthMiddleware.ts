/**
 * Middleware d'authentification pour Socket.IO
 * Vérifie les tokens JWT et gère la détection de redémarrage serveur
 */

import { isSameSiteOrigin } from '@/lib/requestOrigin'
import { Socket } from 'socket.io'
import { resolveSocketIdentity } from './playerIdentity'

/**
 * Middleware d'authentification Socket.IO
 * @param serverRestartId - ID unique du serveur pour détecter les redémarrages
 */
export function createAuthMiddleware(serverRestartId: string) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      if (!isSameSiteOrigin(socket.handshake.headers.origin, socket.handshake.headers.host)) return next(new Error('Authentication error: Origine refusée'))
      // Vérifier l'ID de session serveur pour détecter les redémarrages
      const clientServerRestartId = socket.handshake.auth.serverRestartId
      
      // Détecter si le serveur a redémarré (ID différent)
      const serverRestarted = 
        clientServerRestartId &&
        clientServerRestartId.trim() !== '' &&
        clientServerRestartId !== serverRestartId

      // Stocker cette information pour l'utiliser après la connexion
      socket.data.serverRestarted = serverRestarted

      const identity = await resolveSocketIdentity(socket)
      if (!identity) return next(new Error('Authentication error: Session invalide ou expirée'))
      socket.data.identity = identity
      socket.data.identified = true
      socket.data.authenticated = identity.kind === 'USER'
      socket.data.userId = identity.userId
      socket.data.guestSessionId = identity.guestSessionId
      socket.data.username = identity.playerName
      socket.data.playerName = identity.playerName
      socket.data.serverRestartId = serverRestartId

      next()
    } catch (error) {
      console.error("[SOCKET] Erreur d'authentification:", error)
      next(new Error('Authentication error'))
    }
  }
}

