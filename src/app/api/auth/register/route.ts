import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/lib/authServer'
import { sendConfirmationEmail } from '@/lib/emailSender'
import { allowAuthAttempt } from '@/lib/authRateLimit'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    if (!await allowAuthAttempt(request, 'register')) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie plus tard.' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password, username } = body as {
      email?: string
      password?: string
      username?: string
    }

    if (!email || !password || !username || !EMAIL.test(email) || username.trim().length < 3 || username.length > 32) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom d’utilisateur sont requis.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      )
    }

    const { authUser, emailVerificationToken } = await registerUser({
      email,
      password,
      username,
    })

    // Utiliser l'URL de base depuis les variables d'environnement en priorité
    // Sinon utiliser l'origin de la requête (qui peut être localhost en dev)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    request.nextUrl.origin
    // IMPORTANT :
    // La route de confirmation est une route API située sous /api/auth/confirm (voir src/app/api/auth/confirm/route.ts).
    // Il faut donc générer un lien vers /api/auth/confirm et non /auth/confirm,
    // sinon l'utilisateur arrive sur une page inexistante et obtient une 404.
    const confirmationUrl = `${baseUrl}/api/auth/confirm?token=${encodeURIComponent(
      emailVerificationToken
    )}`

    // Envoyer l'email de confirmation (ne pas faire échouer la requête si l'email échoue)
    let emailSent = true
    try {
      await sendConfirmationEmail({
        to: authUser.email,
        confirmationUrl,
      })
    } catch (error) {
      console.error('Erreur envoi email (compte créé quand même):', error)
      // Ne pas faire échouer la requête si l'email échoue,
      // mais ajuster le message retourné au client.
      emailSent = false
    }

    return NextResponse.json(
      {
        message: emailSent
          ? 'Compte créé. Vérifie ton email pour confirmer ton inscription.'
          : "Compte créé, mais l’email de confirmation n’a pas pu être envoyé. Tu pourras réessayer plus tard depuis la page de connexion.",
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur lors de la création du compte.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}


