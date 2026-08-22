import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/authServer'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body as { token?: string; password?: string }

    if (!token || !password || typeof token !== 'string' || typeof password !== 'string' || token.length > 512) {
      return NextResponse.json(
        { error: 'Token et nouveau mot de passe sont requis.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Base de données indisponible.' },
        { status: 500 }
      )
    }

    // Vérifier le token
    const { data: row, error } = await supabase
      .from('password_reset_tokens')
      .select('user_id, used, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json(
        { error: 'Lien de réinitialisation invalide ou expiré.' },
        { status: 400 }
      )
    }

    if (row.used) {
      return NextResponse.json(
        { error: 'Ce lien de réinitialisation a déjà été utilisé.' },
        { status: 400 }
      )
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Ce lien de réinitialisation a expiré.' },
        { status: 400 }
      )
    }

    const userId = row.user_id as string

    // Mettre à jour le mot de passe
    const newHash = await hashPassword(password)

    const { error: updateError } = await supabase
      .from('auth_local_users')
      .update({ password_hash: newHash })
      .eq('id', userId)

    if (updateError) {
      console.error('Erreur mise à jour mot de passe:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du mot de passe.' },
        { status: 500 }
      )
    }

    // Marquer le token comme utilisé
    const { error: tokenUpdateError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token)

    if (tokenUpdateError) {
      console.error('Erreur mise à jour token reset:', tokenUpdateError)
    }

    return NextResponse.json(
      { message: 'Mot de passe mis à jour avec succès. Tu peux maintenant te connecter.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur reset-password:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation du mot de passe.' },
      { status: 500 }
    )
  }
}


