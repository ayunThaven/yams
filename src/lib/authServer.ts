/**
 * Logique d'authentification côté serveur
 * Utilise simplement la base Postgres (via Supabase Admin) comme stockage.
 *
 */

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { createAdminClient } from './supabase/admin'

const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 4 // 4h

function getJwtSecret(): string | null {
  const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) {
    console.error('⚠️ AUTH_JWT_SECRET manquant - générez une clé forte dans vos variables d’environnement')
    return null
  }
  return secret
}

export interface AuthUser {
  id: string
  email: string
}

export interface RegisterParams {
  email: string
  password: string
  username: string
}

export interface AuthResult {
  user: AuthUser
  token: string
  expiresIn: number
}

function getSupabaseAdmin() {
  const supabase = createAdminClient()
  if (!supabase) {
    throw new Error('Supabase Admin client non disponible')
  }
  return supabase
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateJwt(payload: AuthUser): { token: string; expiresIn: number } {
  const secret = getJwtSecret()
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET manquant')
  }

  const expiresIn = JWT_EXPIRES_IN_SECONDS
  const token = jwt.sign(payload, secret, { expiresIn })
  return { token, expiresIn }
}

export function verifyJwtToken(token: string): AuthUser | null {
  const secret = getJwtSecret()
  if (!secret) {
    console.error('[JWT] AUTH_JWT_SECRET manquant côté serveur lors de la vérification.')
    return null
  }
  try {
    const decoded: unknown = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (!decoded || typeof decoded !== 'object') return null
    const payload = decoded as Record<string, unknown>
    if (payload.kind === 'GUEST' || typeof payload.id !== 'string' || typeof payload.email !== 'string') return null
    return { id: payload.id, email: payload.email }
  } catch (error) {
    console.error('[JWT] Erreur lors de la vérification du token:', error)
    return null
  }
}

/**
 * Inscription d’un nouvel utilisateur :
 * - crée une entrée dans auth_local_users (email + hash)
 * - crée le profil dans public.users (stats)
 * - génère un token de vérification d’email
 */
export async function registerUser(params: RegisterParams): Promise<{
  authUser: AuthUser
  emailVerificationToken: string
}> {
  const { email, password, username } = params
  const supabase = getSupabaseAdmin()

  // Vérifier unicité de l'email
  const { data: existing, error: existingError } = await supabase
    .from('auth_local_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingError) {
    console.error('Erreur vérification email existant:', existingError)
    throw new Error('Erreur lors de la vérification de l’email')
  }
  if (existing) {
    throw new Error('Cet email est déjà utilisé')
  }

  const password_hash = await hashPassword(password)

  // Générer un UUID pour l'utilisateur (la table users n'a pas de default pour id)
  const userId = randomUUID()

  // Créer d'abord le profil de stats dans users (la FK auth_local_users -> users nécessite que users existe d'abord)
  const { data: createdUser, error: createUserError } = await supabase
    .from('users')
    .insert({
      id: userId,
      username,
      // Générer le même type d'avatar par défaut que dans la migration SQL (Dicebear basé sur l'id)
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      parties_jouees: 0,
      parties_gagnees: 0,
      parties_abandonnees: 0,
      meilleur_score: 0,
      nombre_yams_realises: 0,
      meilleure_serie_victoires: 0,
      serie_victoires_actuelle: 0,
      xp: 0,
      level: 1,
    })
    .select('id')
    .single()

  if (createUserError || !createdUser) {
    console.error('Erreur création profil users:', createUserError)
    throw new Error('Impossible de créer le profil utilisateur')
  }

  // Créer ensuite l'utilisateur auth avec le même id pour garder la cohérence
  const { data: createdAuth, error: createAuthError } = await supabase
    .from('auth_local_users')
    .insert({
      id: userId,
      email: email.toLowerCase(),
      password_hash,
      email_verified: false,
    })
    .select('id, email')
    .single()

  if (createAuthError || !createdAuth) {
    console.error('Erreur création auth_local_users:', createAuthError)
    // Nettoyer le profil users créé si l'auth échoue
    await supabase.from('users').delete().eq('id', userId)
    throw new Error('Impossible de créer le compte utilisateur')
  }

  // Générer un token de vérification d’email
  const { data: tokenRow, error: tokenError } = await supabase
    .from('email_verification_tokens')
    .insert({
      user_id: userId,
      // token généré côté SQL (DEFAULT gen_random_uuid()) si possible
    })
    .select('token')
    .single()

  if (tokenError || !tokenRow) {
    console.error('Erreur création token de vérification:', tokenError)
    throw new Error('Erreur lors de la génération du lien de confirmation')
  }

  return {
    authUser: {
      id: userId,
      email: createdAuth.email,
    },
    emailVerificationToken: tokenRow.token as string,
  }
}

/**
 * Connexion par email/mot de passe
 */
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('auth_local_users')
    .select('id, email, password_hash, email_verified')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error) {
    console.error('Erreur récupération utilisateur auth_local_users:', error)
    throw new Error('Erreur lors de la connexion')
  }

  if (!user) {
    throw new Error('Identifiants invalides')
  }

  const ok = await verifyPassword(password, user.password_hash as string)
  if (!ok) {
    throw new Error('Identifiants invalides')
  }

  if (!user.email_verified) {
    throw new Error('Email non vérifié. Merci de confirmer votre adresse email.')
  }

  const payload: AuthUser = { id: user.id as string, email: user.email as string }
  const { token, expiresIn } = generateJwt(payload)

  return {
    user: payload,
    token,
    expiresIn,
  }
}

/**
 * Valide un token de confirmation d’email
 */
export async function confirmEmailToken(token: string): Promise<AuthUser> {
  const supabase = getSupabaseAdmin()

  const { data: row, error } = await supabase
    .from('email_verification_tokens')
    .select('user_id, used, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !row) {
    throw new Error('Lien de confirmation invalide ou expiré')
  }

  if (row.used) {
    throw new Error('Ce lien de confirmation a déjà été utilisé')
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new Error('Ce lien de confirmation a expiré')
  }

  const userId = row.user_id as string

  // Marquer le token comme utilisé + email comme vérifié
  const { error: updateError } = await supabase
    .from('email_verification_tokens')
    .update({ used: true })
    .eq('token', token)

  if (updateError) {
    console.error('Erreur mise à jour token vérification:', updateError)
  }

  const { data: authUser, error: authError } = await supabase
    .from('auth_local_users')
    .update({ email_verified: true })
    .eq('id', userId)
    .select('id, email')
    .single()

  if (authError || !authUser) {
    console.error('Erreur mise à jour email_verified:', authError)
    throw new Error('Erreur lors de la confirmation de votre email')
  }

  return { id: authUser.id as string, email: authUser.email as string }
}

/**
 * Récupère le profil utilisateur (table users) à partir de l’id authentifié
 */
export async function getUserProfileById(userId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()

  if (error) {
    console.error('Erreur récupération profil utilisateur:', error)
    throw new Error('Impossible de récupérer le profil utilisateur')
  }

  return data
}


