import { NextResponse } from 'next/server'

/**
 * Achievements are evaluated from trusted server-side game events only.
 */
export function POST() {
  return NextResponse.json(
    { error: 'Les succès sont évalués par le serveur de jeu.' },
    { status: 410 }
  )
}
