import type { ScoreCategory } from './game'

export type BackofficeRole = 'admin' | 'operator'
export type BugTicketStatus = 'new' | 'confirmed' | 'in_progress' | 'resolved' | 'rejected'
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical'

export interface BackofficeDevice {
  id: string
  user_id: string | null
  label: string | null
  last_used_at: string
  expires_at: string
  revoked_at: string | null
  created_at: string
}

export interface EditablePlayerStats {
  parties_jouees?: number
  parties_gagnees?: number
  parties_abandonnees?: number
  meilleur_score?: number
  nombre_yams_realises?: number
  meilleure_serie_victoires?: number
  serie_victoires_actuelle?: number
  xp?: number
}

export interface GameScoreAction {
  id: string
  game_id: string
  user_id: string
  player_name: string
  turn_number: number
  category: ScoreCategory
  dice_values: number[]
  score: number
  total_after: number
  yams_face: number | null
  created_at: string
}

export interface BugTicket {
  id: string
  reporter_user_id: string
  game_id: string | null
  title: string
  description: string
  reproduction_steps: string
  expected_behavior: string
  actual_behavior: string
  status: BugTicketStatus
  priority: TicketPriority
  assigned_to: string | null
  public_resolution: string | null
  confirmed_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  attachment?: { id: string; mime_type: string; size_bytes: number } | null
}

