import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Endpoint supprimé: les statistiques sont calculées et enregistrées côté serveur à la fin de la partie.',
    },
    { status: 410 }
  )
}


