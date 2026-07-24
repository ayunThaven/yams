import { NextResponse } from 'next/server'

/**
 * Results are finalized by the Socket.IO server from its authoritative game
 * state. This endpoint intentionally rejects client-supplied scores and XP.
 */
export function POST() {
  return NextResponse.json(
    { error: 'Les statistiques sont finalisées par le serveur de jeu.' },
    { status: 410 }
  )
}
