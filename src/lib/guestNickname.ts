import type { SupabaseClient } from '@supabase/supabase-js'

export const RESERVED_NICKNAME_MESSAGE = 'Ce pseudo est déjà utilisé par un compte. Choisissez-en un autre ou connectez-vous.'

export async function isGuestNicknameAvailable(supabase: SupabaseClient, nickname: string): Promise<boolean> {
  const literal = nickname.replace(/[\\%_]/g, character => `\\${character}`)
  const { data, error } = await supabase.from('users').select('id').ilike('username', literal).limit(1)
  if (error || !data) throw new Error('Vérification du pseudo indisponible')
  return data.length === 0
}
