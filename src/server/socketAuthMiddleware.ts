/**
 * Middleware d'authentification pour Socket.IO
 * Vérifie les tokens JWT et gère la détection de redémarrage serveur
 */

import { Socket } from 'socket.io'
import { verifyToken, getUsernameFromId } from './authMiddleware'

const AUTH_COOKIE_NAME = 'yams_auth_token'

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const prefix = `${name}=`
  const entry = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

/**
 * Middleware d'authentification Socket.IO
 * @param serverRestartId - ID unique du serveur pour détecter les redémarrages
 */
export function createAuthMiddleware(serverRestartId: string) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      // Vérifier l'ID de session serveur pour détecter les redémarrages
      const clientServerRestartId = socket.handshake.auth.serverRestartId
      
      // Détecter si le serveur a redémarré (ID différent)
      const serverRestarted = 
        clientServerRestartId &&
        clientServerRestartId.trim() !== '' &&
        clientServerRestartId !== serverRestartId

      // Stocker cette information pour l'utiliser après la connexion
      socket.data.serverRestarted = serverRestarted

      // Extraire le token des handshake auth ou query
      const token = readCookie(socket.handshake.headers.cookie, AUTH_COOKIE_NAME)

      if (!token) {
        console.error('[SOCKET] Connexion refusée: Token manquant')
        return next(new Error('Authentication error: Token manquant'))
      }

      // Vérifier le token
      const { valid, userId, error } = await verifyToken(token as string)

      if (!valid || !userId) {
        console.error('[SOCKET] Connexion refusée: Token invalide -', error)
        return next(new Error(`Authentication error: ${error}`))
      }

      // Stocker les infos utilisateur dans socket.data
      socket.data.userId = userId
      socket.data.authenticated = true

      // Récupérer le username depuis la base de données
      const username = await getUsernameFromId(userId)
      socket.data.username = username
      socket.data.serverRestartId = serverRestartId

      next()
    } catch (error) {
      console.error("[SOCKET] Erreur d'authentification:", error)
      next(new Error('Authentication error'))
    }
  }
}

