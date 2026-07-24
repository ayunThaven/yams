/**
 * Serveur Next.js avec Socket.IO intégré
 * Point d'entrée principal de l'application
 */

// Charger les variables d'environnement en premier
import dotenv from 'dotenv'
import { resolve } from 'path'

// Charger .env.local en priorité (comme Next.js), puis .env
dotenv.config({ path: resolve(process.cwd(), '.env.local') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as IOServer } from 'socket.io'
import { createAdminClient } from './src/lib/supabase/admin'
import { clearAllGames } from './src/server/gameManager'
import { createAuthMiddleware } from './src/server/socketAuthMiddleware'
import { setupRoomHandlers } from './src/server/socketRoomHandlers'
import { setupGameHandlers } from './src/server/socketGameHandlers'
import { setupDisconnectHandlers } from './src/server/socketDisconnectHandlers'

// ID unique du serveur généré au démarrage pour détecter les redémarrages
const SERVER_RESTART_ID = Date.now().toString()

// Récupérer le client Supabase Admin
const supabase = createAdminClient()

// Configuration Next.js
const dev = process.env.NODE_ENV !== 'production'
// En production (Docker), utiliser 0.0.0.0 pour accepter les connexions externes
const hostname = process.env.HOSTNAME || (dev ? 'localhost' : '0.0.0.0')
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

/**
 * Nettoyage au démarrage du serveur
 * Marque les parties en cours comme interrompues
 */
async function cleanupOnStartup() {
  // Nettoyer les gestionnaires de jeu en mémoire
  clearAllGames()

  // Vérifier que supabase est disponible
  if (!supabase) {
    console.warn('[SERVER] Supabase non disponible, impossible de marquer les parties')
    return
  }

  // Marquer les parties en cours comme interrompues dans la base de données
  try {
    const { data, error } = await supabase
      .from('games')
      .update({
        status: 'server_interrupted',
        winner: null,
      })
      .eq('status', 'in_progress')
      .select()

    if (error) {
      console.error('[SERVER] Erreur lors du marquage des parties:', error)
    } else if (data && data.length > 0) {
      // Information uniquement en cas de parties réellement impactées
      // (laissé silencieux pour éviter le bruit en console)
    }
  } catch (err) {
    console.error('[SERVER] Erreur lors de la vérification des parties:', err)
  }
}

/**
 * Initialisation et démarrage du serveur
 */
app.prepare().then(async () => {
  // Nettoyage au démarrage
  await cleanupOnStartup()

  // Créer le serveur HTTP
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialiser Socket.IO
  const io = new IOServer(server, {
    path: '/api/socket',
    // Configuration pour Docker/production
    pingTimeout: 60000, // 60s avant de considérer la connexion morte
    pingInterval: 25000, // Ping toutes les 25s pour maintenir la connexion
    connectTimeout: 45000, // 45s pour établir la connexion initiale
    transports: ['websocket', 'polling'],
  })

  // Middleware d'authentification Socket.IO
  io.use(createAuthMiddleware(SERVER_RESTART_ID))

  // Stocker l'état des rooms (si la partie est démarrée ou non)
  const roomStates = new Map<string, { started: boolean }>()

  // Vérifier que supabase est disponible
  if (!supabase) {
    console.error('[SERVER] ERREUR CRITIQUE: Supabase non disponible')
    console.error('[SERVER] Vérifiez vos variables d\'environnement SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Gestionnaires de connexion Socket.IO
  io.on('connection', (socket) => {
    // Envoyer l'ID de session serveur au client
    socket.emit('server_restart_id', SERVER_RESTART_ID)

    // Si un redémarrage serveur a été détecté, informer le client
    if (socket.data.serverRestarted) {
      socket.emit('server_restart_detected', {
        message: 'Le serveur a redémarré. Reconnexion en cours...',
        newServerRestartId: SERVER_RESTART_ID,
      })
    }

    // Configurer les gestionnaires d'événements
    setupRoomHandlers(io, socket, roomStates, supabase)
    setupGameHandlers(io, socket, roomStates, supabase)
    setupDisconnectHandlers(io, socket, roomStates, supabase)
  })

  // Démarrer le serveur
  server.listen(port, hostname, () => {
    // Serveur démarré
  })
})
