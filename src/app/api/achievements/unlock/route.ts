import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Endpoint supprimé: les succès sont débloqués par les actions serveur autorisées.',
    },
    { status: 410 }
  )
}


