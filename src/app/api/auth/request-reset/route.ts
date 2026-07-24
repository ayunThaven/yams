import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/emailSender'
import { allowAuthAttempt } from '@/lib/authRateLimit'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    if (!await allowAuthAttempt(request, 'request-reset')) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie plus tard.' }, { status: 429 })
    }

    const body = await request.json()
    const { email } = body as { email?: string }

    if (!email || !EMAIL.test(email)) {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Base de données indisponible.' },
        { status: 500 }
      )
    }

    // Trouver l'utilisateur dans auth_local_users
    const { data: user, error } = await supabase
      .from('auth_local_users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    // Pour éviter de leak si un email existe ou non, on renvoie toujours un succès
    if (error || !user) {
      console.warn('Demande de reset pour email inexistant ou erreur:', error)
      return NextResponse.json(
        {
          message:
            'Si un compte existe avec cet email, tu recevras un lien de réinitialisation.',
        },
        { status: 200 }
      )
    }

    // Créer un token de reset
    const { data: tokenRow, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow) {
      console.error('Erreur création token reset:', tokenError)
      return NextResponse.json(
        { error: 'Erreur lors de la génération du lien de réinitialisation.' },
        { status: 500 }
      )
    }

    // Utiliser l'URL de base depuis les variables d'environnement en priorité
    // Sinon utiliser l'origin de la requête (qui peut être localhost en dev)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    request.nextUrl.origin
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(
      tokenRow.token as string
    )}`

    // Envoyer l'email de réinitialisation.
    // Même si l'envoi échoue (timeout SMTP, etc.), on ne doit pas révéler
    // si l'adresse existe ou non : on loggue juste côté serveur.
    try {
      await sendPasswordResetEmail({
        to: user.email as string,
        resetUrl,
      })
    } catch (error) {
      console.error('Erreur envoi email de reset (token créé quand même):', error)
      // On continue vers la réponse générique ci‑dessous.
    }

    return NextResponse.json(
      {
        message:
          'Si un compte existe avec cet email, tu recevras un lien de réinitialisation.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur request-reset:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la demande de réinitialisation.' },
      { status: 500 }
    )
  }
}


