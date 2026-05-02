import type { GameState, ScoreCategory } from './game'
import type { Achievement } from './achievement'

export type RoomPlayer = {
  id: string
  name: string
  userId?: string
  avatar?: string
  ready?: boolean
}

export interface ServerToClientEvents {
  achievements_unlocked: (achievements: Achievement[]) => void
  countdown_cancelled: () => void
  countdown_started: (initialSeconds: number) => void
  countdown_tick: (remainingSeconds: number) => void
  dice_rolled: () => void
  error: (data: { message: string }) => void
  game_ended: (data: { winner: string | null; reason: string; message: string }) => void
  game_not_found: (data: { message: string }) => void
  game_started: (initialState: GameState) => void
  game_update: (updatedState: GameState) => void
  host_left_finished_game: (data: { message: string }) => void
  max_players_updated: (data: { maxPlayers: number }) => void
  rematch_available: (data: { newRoomId: string; hostName: string }) => void
  room_update: (room: { players: RoomPlayer[]; started: boolean }) => void
  server_restart_detected: (data: { message: string; newServerRestartId: string }) => void
  server_restart_id: (restartId: string) => void
  system_message: (message: string) => void
  turn_timer_update: (timeLeft: number) => void
}

export interface ClientToServerEvents {
  abandon_game: (roomId: string) => void
  choose_score: (payload: { roomId: string; category: ScoreCategory }) => void
  host_leaving_finished_game: (roomId: string) => void
  join_room: (roomId: string) => void
  leave_room: (roomId: string) => void
  player_ready: (roomId: string) => void
  rematch_created: (payload: { oldRoomId: string; newRoomId: string; hostName: string }) => void
  roll_dice: (roomId: string) => void
  start_countdown: (roomId: string) => void
  toggle_die_lock: (payload: { roomId: string; dieIndex: number }) => void
  update_max_players: (payload: { roomId: string; maxPlayers: number }) => void
}
