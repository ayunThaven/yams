import { Server } from 'socket.io'
import { SupabaseClient } from '@supabase/supabase-js'
import type {
  GameEndReason,
  GameState,
  PersistedGameResult,
  PlayerGameState,
  PlayerResult,
} from '@/types/game'
import type { UserProfile } from '@/types/user'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { countYamsInScoreSheet, getUserProfile } from '@/lib/userStats'
import { updateFinishedGame } from './gameDbUtils'
import { recordGamePlayerResult } from './playerResultsService'
import { unlockAchievementsForUser } from './achievementService'

type FinalizeGameParams = {
  io: Server
  supabase: SupabaseClient
  roomId: string
  gameState: GameState
  reason: GameEndReason
}

type RecordAbandonParams = {
  io: Server
  supabase: SupabaseClient
  roomId: string
  gameState: GameState
  player: PlayerGameState
  reason: GameEndReason
}

type BuiltPlayerResult = {
  result: PlayerResult
  profileBefore: UserProfile | null
}

const inFlightFinalizations = new Map<string, Promise<PersistedGameResult>>()
const completedFinalizations = new Map<string, PersistedGameResult>()

function getActivePlayers(gameState: GameState): PlayerGameState[] {
  return gameState.players.filter((player) => !player.abandoned)
}

function getTopScore(gameState: GameState): number | null {
  const activePlayers = getActivePlayers(gameState)
  if (activePlayers.length === 0) return null

  return Math.max(...activePlayers.map((player) => player.totalScore))
}

function isWinningPlayer(gameState: GameState, player: PlayerGameState): boolean {
  if (player.abandoned) return false

  const topScore = getTopScore(gameState)
  return topScore !== null && player.totalScore === topScore
}

function getYamsByFace(scoreSheet: PlayerGameState['scoreSheet']) {
  return {
    1: scoreSheet.ones === 5 ? 1 : 0,
    2: scoreSheet.twos === 10 ? 1 : 0,
    3: scoreSheet.threes === 15 ? 1 : 0,
    4: scoreSheet.fours === 20 ? 1 : 0,
    5: scoreSheet.fives === 25 ? 1 : 0,
    6: scoreSheet.sixes === 30 ? 1 : 0,
  } as const
}

function hasUpperBonus(scoreSheet: PlayerGameState['scoreSheet']): boolean {
  return (
    (scoreSheet.ones || 0) +
      (scoreSheet.twos || 0) +
      (scoreSheet.threes || 0) +
      (scoreSheet.fours || 0) +
      (scoreSheet.fives || 0) +
      (scoreSheet.sixes || 0) >=
    63
  )
}

function hasDefeatedAyun(gameState: GameState, player: PlayerGameState): boolean {
  if (!isWinningPlayer(gameState, player)) return false

  const ayunPlayer = gameState.players.find(
    (candidate) => candidate.name.trim().toLowerCase() === 'ayun'
  )

  return !!ayunPlayer && ayunPlayer.totalScore < player.totalScore
}

async function buildPlayerResult(
  supabase: SupabaseClient,
  roomId: string,
  gameState: GameState,
  player: PlayerGameState,
  reason: GameEndReason
): Promise<BuiltPlayerResult | null> {
  if (!player.userId) {
    return null
  }

  const { data: profileBefore } = await getUserProfile(supabase, player.userId)
  const yamsCount = countYamsInScoreSheet(player.scoreSheet)
  const abandoned = player.abandoned || reason === 'abandon'
  const won = !abandoned && isWinningPlayer(gameState, player)
  const xpGained = abandoned
    ? -(profileBefore?.level || 1) * 10
    : Math.floor(player.totalScore / 10) + (won ? 25 : 0)

  return {
    profileBefore,
    result: {
      gameId: roomId,
      userId: player.userId,
      playerName: player.name,
      score: player.totalScore,
      won,
      abandoned,
      yamsCount,
      xpGained,
      reason,
    },
  }
}

async function unlockResultAchievements(
  supabase: SupabaseClient,
  gameState: GameState,
  player: PlayerGameState,
  built: BuiltPlayerResult
) {
  const { result, profileBefore } = built
  const directAchievementIds: string[] = []

  if (result.abandoned) {
    directAchievementIds.push('give_up')
  }

  if (hasDefeatedAyun(gameState, player)) {
    directAchievementIds.push('win_ayun')
  }

  const directAchievements = await unlockAchievementsForUser(
    supabase,
    result.userId,
    directAchievementIds
  )

  const { data: profileAfter } = await getUserProfile(supabase, result.userId)
  if (!profileAfter) {
    return directAchievements
  }

  const computedAchievements = await checkAndUnlockAchievements(
    supabase,
    result.userId,
    {
      userProfile: {
        id: result.userId,
        nombre_yams_realises: profileAfter.nombre_yams_realises,
        parties_gagnees: profileAfter.parties_gagnees,
        meilleur_score: profileAfter.meilleur_score,
        serie_victoires_actuelle: profileAfter.serie_victoires_actuelle,
        level: profileAfter.level,
        parties_jouees: profileAfter.parties_jouees,
        parties_jouees_avant:
          profileBefore?.parties_jouees ?? Math.max(0, profileAfter.parties_jouees - 1),
        parties_gagnees_avant:
          profileBefore?.parties_gagnees ??
          profileAfter.parties_gagnees - (result.won ? 1 : 0),
      },
      gameData: {
        score: result.score,
        won: result.won,
        abandoned: result.abandoned,
        yamsCount: result.yamsCount,
        yamsByFace: getYamsByFace(player.scoreSheet),
        variant: gameState.variant,
        hasBonus: hasUpperBonus(player.scoreSheet),
      },
    }
  )

  return [...directAchievements, ...computedAchievements]
}

async function recordAndNotifyPlayerResult(
  io: Server,
  supabase: SupabaseClient,
  gameState: GameState,
  player: PlayerGameState,
  built: BuiltPlayerResult
): Promise<PlayerResult | null> {
  const { recorded } = await recordGamePlayerResult(supabase, built.result)

  if (!recorded) {
    return built.result
  }

  const achievements = await unlockResultAchievements(supabase, gameState, player, built)
  if (achievements.length > 0) {
    io.to(player.id).emit('achievements_unlocked', achievements)
  }

  return built.result
}

function buildGameEndedMessage(gameState: GameState, reason: GameEndReason): string {
  const winner = gameState.winner || 'Un joueur'

  if (reason === 'abandon') {
    return `${winner} remporte la partie par abandon !`
  }

  if (reason === 'timeout') {
    return `${winner} remporte la partie !`
  }

  return `${winner} remporte la partie !`
}

export async function recordPlayerAbandon({
  io,
  supabase,
  roomId,
  gameState,
  player,
  reason,
}: RecordAbandonParams): Promise<PlayerResult | null> {
  // Abandon can be recorded before the game itself is finished, so this uses
  // the same idempotent player-result RPC without emitting a room-wide end event.
  const built = await buildPlayerResult(supabase, roomId, gameState, player, reason)
  if (!built) return null

  return recordAndNotifyPlayerResult(io, supabase, gameState, player, built)
}

export async function finalizeGame({
  io,
  supabase,
  roomId,
  gameState,
  reason,
}: FinalizeGameParams): Promise<PersistedGameResult> {
  // Socket events can race: manual score, timeout and disconnect handlers may
  // all observe the end state. Keep a process-local guard here and rely on the
  // database unique key for cross-request idempotence.
  const completed = completedFinalizations.get(roomId)
  if (completed) return completed

  const inFlight = inFlightFinalizations.get(roomId)
  if (inFlight) return inFlight

  const promise = finalizeGameInternal({ io, supabase, roomId, gameState, reason })
  inFlightFinalizations.set(roomId, promise)

  try {
    const result = await promise
    completedFinalizations.set(roomId, result)
    return result
  } finally {
    inFlightFinalizations.delete(roomId)
  }
}

async function finalizeGameInternal({
  io,
  supabase,
  roomId,
  gameState,
  reason,
}: FinalizeGameParams): Promise<PersistedGameResult> {
  gameState.gameStatus = 'finished'

  await updateFinishedGame(supabase, roomId, gameState)

  const playerResults: PlayerResult[] = []

  for (const player of gameState.players) {
    const built = await buildPlayerResult(supabase, roomId, gameState, player, reason)
    if (!built) continue

    const result = await recordAndNotifyPlayerResult(io, supabase, gameState, player, built)
    if (result) {
      playerResults.push(result)
    }
  }

  io.to(roomId).emit('game_update', gameState)
  io.to(roomId).emit('game_ended', {
    winner: gameState.winner,
    reason,
    message: buildGameEndedMessage(gameState, reason),
  })

  return {
    gameId: roomId,
    winner: gameState.winner,
    reason,
    players: playerResults,
  }
}
