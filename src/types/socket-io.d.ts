import 'socket.io'
import type { PlayerIdentity } from './game'

// Extension des types Socket.IO pour inclure nos propriétés personnalisées
declare module 'socket.io' {
  interface Socket {
    data: {
      memberships?: Record<string, { gamePlayerId: string; isHost: boolean; ready: boolean }>
      identity?: PlayerIdentity
      identified?: boolean
      guestSessionId?: string
      gamePlayerId?: string
      userId?: string
      authenticated?: boolean
      username?: string
      playerName?: string
      avatar?: string
      isHost?: boolean
      ready?: boolean
      serverRestartId?: string
      serverRestarted?: boolean
      voluntaryAbandon?: boolean
    }
  }
}
