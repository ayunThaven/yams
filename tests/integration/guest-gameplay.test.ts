import assert from 'node:assert/strict'
import test from 'node:test'
import type { Server, Socket } from 'socket.io'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameVariant, PlayerIdentity, ScoreCategory } from '@/types/game'
import { setupRoomHandlers } from '@/server/socketRoomHandlers'
import { setupGameHandlers } from '@/server/socketGameHandlers'
import { setupDisconnectHandlers } from '@/server/socketDisconnectHandlers'
import { clearAllGames, getGameState, initializeGame } from '@/server/gameManager'
import { getIdentityKey } from '@/lib/playerIdentity'
import { canChooseCategory } from '@/lib/variantLogic'
import { GameRepository } from '@/server/gameRepository'
import { handleTimerExpiredAndRestart } from '@/server/timerUtils'

const settle = () => new Promise<void>(resolve => setImmediate(resolve))
type Handler = (...args: unknown[]) => unknown
type Participant = { id: string; userId: string | null; guestSessionId: string | null; name: string }

function harness(roomId: string, owner: PlayerIdentity, variant: GameVariant = 'classic', maxPlayers = 8) {
  const rooms = new Map<string, Set<string>>()
  const sockets = new Map<string, ReturnType<typeof makeSocket>>()
  const roomStates = new Map<string, { started: boolean }>()
  const players = new Map<string, Participant>()
  const results = new Map<string, Record<string, unknown>>()
  const scores: Record<string, unknown>[] = []
  const achievements: string[] = []
  const updatedUsers = new Set<string>()
  const snapshots = new Map<string, { state: unknown; version: number }>()
  const game = { id: roomId, status: 'waiting', owner: owner.userId ?? null, guest_owner_session_id: owner.guestSessionId ?? null, variant, max_players: maxPlayers, visibility: 'PRIVATE', match_type: 'CASUAL' }
  const supabase = {
    from(table: string) {
      let filter = ''
      const data = () => table === 'games' ? game : table === 'users' ? { id: filter, username: 'User', level: 1, parties_jouees: 1, parties_gagnees: 0, xp: 0 } : table === 'game_results' ? [...results.values()] : table === 'game_snapshots' ? snapshots.get(filter) ?? null : null
      const query = {
        select: () => query,
        eq: (_key: string, value: string) => { filter = value; return query },
        in: () => query,
        update: (values: object) => { if (table === 'games') Object.assign(game, values); return query },
        single: async () => ({ data: data(), error: null }),
        maybeSingle: async () => ({ data: data(), error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: table === 'users' ? [] : data(), error: null }),
      }
      return query
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'join_casual_game' || name === 'ensure_user_game_player') {
        const key = args.p_user_id ? `USER:${args.p_user_id}` : `GUEST:${args.p_guest_session_id}`
        let player = players.get(key)
        if (!player) {
          player = { id: `participant-${players.size}`, userId: args.p_user_id as string ?? null, guestSessionId: args.p_guest_session_id as string ?? null, name: args.p_player_name as string }
          players.set(key, player)
        }
        return { data: player.id, error: null }
      }
      if (name === 'save_game_snapshot' || name === 'record_player_score_action_and_snapshot') {
        if (name.startsWith('record_')) {
          const player = [...players.values()].find(p => p.id === args.p_game_player_id)!
          scores.push({ ...args, user_id: player.userId })
        }
        const version = (snapshots.get(roomId)?.version ?? 0) + 1
        snapshots.set(roomId, { state: JSON.parse(JSON.stringify(args.p_state)), version })
        return { data: version, error: null }
      }
      if (name === 'finalize_game') {
        for (const row of args.p_results as Record<string, unknown>[]) {
          const player = [...players.values()].find(p => p.id === row.game_player_id)!
          if (!results.has(player.id)) {
            results.set(player.id, { ...row, user_id: player.userId, game_id: roomId, game_player_id: player.id, game_players: { guest_session_id: player.guestSessionId }, xp_gained: player.userId ? 10 : 0 })
            if (player.userId) updatedUsers.add(player.userId)
          }
        }
        game.status = 'finished'
        return { data: { first_completion: true }, error: null }
      }
      if (name === 'record_player_game_result') {
        const player = [...players.values()].find(p => p.id === args.p_game_player_id)!
        results.set(player.id, { game_id: roomId, game_player_id: player.id, game_players: { guest_session_id: player.guestSessionId }, user_id: player.userId, xp_gained: args.p_xp_gained, abandoned: args.p_abandoned })
        return { data: true, error: null }
      }
      if (name === 'unlock_achievement') { achievements.push(args.p_user_id as string); return { data: false, error: null } }
      throw new Error(`Unexpected RPC ${name}`)
    },
  } as unknown as SupabaseClient
  const io = {
    sockets: { adapter: { rooms }, sockets },
    to: () => ({ emit: () => undefined }),
  } as unknown as Server
  function makeSocket(id: string, identity: PlayerIdentity, name: string) {
    const handlers = new Map<string, Handler>()
    const events: { name: string; value: unknown }[] = []
    const socket = {
      id, connected: true, rooms: new Set([id]), data: { identity, ...identity, username: name, playerName: name, authenticated: identity.kind === 'USER', identified: true },
      on: (event: string, handler: Handler) => { handlers.set(event, handler) },
      emit: (name: string, value: unknown) => { events.push({ name, value }) },
      to: () => ({ emit: () => undefined }),
      join: async (room: string) => { socket.rooms.add(room); if (!rooms.has(room)) rooms.set(room, new Set()); rooms.get(room)!.add(id) },
      leave: async (room: string) => { socket.rooms.delete(room); rooms.get(room)?.delete(id) },
      disconnect: () => { socket.connected = false },
    }
    const asSocket = socket as unknown as Socket
    setupRoomHandlers(io, asSocket, roomStates, supabase)
    setupGameHandlers(io, asSocket, roomStates, supabase)
    setupDisconnectHandlers(io, asSocket, roomStates, supabase)
    return { ...socket, asSocket, events, send: async (event: string, value?: unknown) => { await handlers.get(event)?.(value); await settle() } }
  }
  return { game, players, results, scores, achievements, updatedUsers, supabase, roomStates,
    socket(id: string, identity: PlayerIdentity, name: string) { const socket = makeSocket(id, identity, name); sockets.set(id, socket); return socket },
  }
}

for (const [index, kinds] of [ ['USER', 'USER', 'GUEST'], ['GUEST', 'USER', 'GUEST'], ['GUEST', 'GUEST', 'GUEST'], ['USER', 'GUEST', 'USER', 'GUEST'] ].entries()) {
  test(`complete Casual game, reconnect and results: ${kinds.join(' + ')}`, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const identities: PlayerIdentity[] = kinds.map((kind, i) => kind === 'USER' ? { kind, userId: `user-${index}-${i}` } : { kind: 'GUEST', guestSessionId: `guest-${index}-${i}` })
    const roomId = ['ABCDEFGH', 'BCDEFGHJ', 'CDEFGHJK', 'DEFGHJKL'][index]
    const h = harness(roomId, identities[0], (['classic', 'descending', 'ascending', 'classic'] as const)[index])
    const sockets = identities.map((identity, i) => h.socket(`socket-${index}-${i}`, identity, `Joueur ${i}`))
    t.after(() => { clearAllGames(); t.mock.timers.reset() })
    for (const socket of sockets) await socket.send('join_room', roomId)
    assert.equal(h.players.size, identities.length)
    assert.ok([...h.players.values()].every(p => !!p.userId !== !!p.guestSessionId))
    await sockets[1].send('update_max_players', { roomId, maxPlayers: 7 })
    assert.equal(h.game.max_players, 8)
    await sockets[0].send('update_max_players', { roomId, maxPlayers: 7 })
    assert.equal(h.game.max_players, 7)
    await sockets[1].send('start_countdown', roomId)
    t.mock.timers.tick(10000); await settle()
    assert.equal(getGameState(roomId), null)
    for (const socket of sockets.slice(1)) await socket.send('player_ready', roomId)
    await sockets[0].send('start_countdown', roomId)
    t.mock.timers.tick(10000); await settle()
    assert.equal(getGameState(roomId)?.gameStatus, 'playing')

    const guestIndex = identities.findIndex(identity => identity.kind === 'GUEST')
    const guest = sockets[guestIndex]
    const participantId = h.players.get(getIdentityKey(identities[guestIndex]))!.id
    await guest.send('disconnecting')
    await guest.leave(roomId)
    const replacement = h.socket(`reconnected-${index}`, identities[guestIndex], `Joueur ${guestIndex}`)
    await replacement.send('join_room', roomId)
    sockets[guestIndex] = replacement
    assert.equal(h.players.size, identities.length)
    assert.equal(getGameState(roomId)!.players.find(p => p.guestSessionId === identities[guestIndex].guestSessionId)!.gamePlayerId, participantId)
    assert.equal(getGameState(roomId)!.players.find(p => p.gamePlayerId === participantId)!.id, replacement.id)

    const stranger = h.socket(`stranger-${index}`, { kind: 'GUEST', guestSessionId: 'stranger' }, 'Stranger')
    await stranger.send('join_room', roomId)
    assert.ok(stranger.events.some(event => event.name === 'error'))
    assert.equal(h.players.size, identities.length)
    for (let turn = 0; turn < identities.length * 13; turn++) {
      const state = getGameState(roomId)!
      const player = state.players[state.currentPlayerIndex]
      const socket = sockets.find(candidate => candidate.id === player.id)!
      await socket.send('roll_dice', roomId)
      await socket.send('toggle_die_lock', { roomId, dieIndex: 0 })
      const category = (Object.keys(player.scoreSheet) as ScoreCategory[]).find(category => canChooseCategory(state.variant, category, player.scoreSheet))!
      await socket.send('choose_score', { roomId, category })
    }
    assert.equal(getGameState(roomId)!.gameStatus, 'finished')
    assert.equal(h.results.size, identities.length)
    assert.equal(h.scores.length, identities.length * 13)
    assert.equal(h.updatedUsers.size, identities.filter(identity => identity.kind === 'USER').length)
    assert.ok(h.achievements.every(id => identities.some(identity => identity.kind === 'USER' && identity.userId === id)))
    assert.ok([...h.results.values()].filter(row => !row.user_id).every(row => row.xp_gained === 0))
    assert.ok(h.scores.filter(row => row.user_id === null).every(row => row.p_game_player_id))
    const loaded = await new GameRepository(h.supabase).load(roomId)
    assert.equal(loaded!.players.find(p => p.gamePlayerId === participantId)!.guestSessionId, identities[guestIndex].guestSessionId)
  })
}

test('room capacity, duplicate names and same guest waiting-room rejoin', async t => {
  const owner: PlayerIdentity = { kind: 'GUEST', guestSessionId: 'host' }
  const h = harness('EFGHJKLM', owner, 'classic', 2)
  t.after(clearAllGames)
  const host = h.socket('host-socket', owner, 'Élodie')
  await host.send('join_room', h.game.id)
  const collision = h.socket('collision', { kind: 'GUEST', guestSessionId: 'different' }, 'Élodie')
  await collision.send('join_room', h.game.id)
  assert.ok(collision.events.some(event => event.name === 'error'))
  const guest = h.socket('guest-socket', { kind: 'GUEST', guestSessionId: 'guest' }, 'François')
  await guest.send('join_room', h.game.id)
  const third = h.socket('third', { kind: 'GUEST', guestSessionId: 'third' }, 'Bob')
  await third.send('join_room', h.game.id)
  assert.ok(third.events.some(event => event.name === 'error'))
  await guest.leave(h.game.id)
  const reconnected = h.socket('guest-reconnected', { kind: 'GUEST', guestSessionId: 'guest' }, 'François')
  await reconnected.send('join_room', h.game.id)
  assert.ok(reconnected.rooms.has(h.game.id))
  assert.equal(h.players.size, 2)
})

test('guest grace timeout persists abandon with zero XP', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const owner: PlayerIdentity = { kind: 'GUEST', guestSessionId: 'grace-host' }
  const h = harness('FGHJKLMN', owner)
  const host = h.socket('grace-A', owner, 'Alice')
  const guest = h.socket('grace-B', { kind: 'GUEST', guestSessionId: 'grace-guest' }, 'Bob')
  t.after(() => { clearAllGames(); t.mock.timers.reset() })
  await host.send('join_room', h.game.id); await guest.send('join_room', h.game.id)
  initializeGame(h.game.id, [...h.players.values()].map(p => ({ id: p.guestSessionId === owner.guestSessionId ? host.id : guest.id, name: p.name, guestSessionId: p.guestSessionId!, gamePlayerId: p.id })))
  h.roomStates.set(h.game.id, { started: true })
  await guest.send('disconnecting'); await guest.leave(h.game.id)
  t.mock.timers.tick(59999); await settle()
  assert.equal(h.results.size, 0)
  t.mock.timers.tick(1); await settle()
  assert.equal(getGameState(h.game.id)!.players.find(p => p.guestSessionId === 'grace-guest')!.abandoned, true)
  const result = h.results.get(h.players.get('GUEST:grace-guest')!.id)!
  assert.equal(result.user_id, null); assert.equal(result.xp_gained, 0); assert.equal(result.abandoned, true)
  assert.equal(h.achievements.length, 0)
})

test('Phase 0 user snapshots are hydrated with the original canonical participant', async t => {
  const owner: PlayerIdentity = { kind: 'USER', userId: 'legacy-user' }
  const h = harness('GHJKLMNP', owner)
  t.after(clearAllGames)
  const socket = h.socket('legacy-socket', owner, 'Alice')
  await socket.send('join_room', h.game.id)
  const state = initializeGame(h.game.id, [{ id: socket.id, name: 'Alice', userId: owner.userId }])
  await new GameRepository(h.supabase).save(state)
  const restored = await new GameRepository(h.supabase).load(h.game.id)
  assert.equal(restored!.players[0].gamePlayerId, h.players.get('USER:legacy-user')!.id)
  assert.equal(restored!.players[0].identityKind, 'USER')
  assert.equal(h.players.size, 1)
})

test('automatic guest score persists a canonical action and snapshot', async t => {
  const owner: PlayerIdentity = { kind: 'GUEST', guestSessionId: 'automatic-guest' }
  const h = harness('HJKLMNPQ', owner)
  t.after(clearAllGames)
  const socket = h.socket('automatic-socket', owner, 'Alice')
  await socket.send('join_room', h.game.id)
  initializeGame(h.game.id, [{ id: socket.id, name: 'Alice', guestSessionId: owner.guestSessionId, gamePlayerId: h.players.get('GUEST:automatic-guest')!.id }])
  await handleTimerExpiredAndRestart({ to: () => ({ emit: () => undefined }) } as unknown as Server, h.supabase, h.game.id)
  assert.equal(h.scores.length, 1)
  assert.equal(h.scores[0].user_id, null)
  assert.ok(h.scores[0].p_game_player_id)
})

test('malformed socket payloads are rejected without crashing handlers', async t => {
  const owner: PlayerIdentity = { kind: 'GUEST', guestSessionId: 'malformed-host' }
  const h = harness('JKLMNPQR', owner)
  t.after(clearAllGames)
  const socket = h.socket('malformed-socket', owner, 'Alice')
  for (const event of ['update_max_players', 'choose_score', 'toggle_die_lock', 'rematch_created']) {
    await socket.send(event, null)
  }
  assert.equal(socket.events.filter(event => event.name === 'error').length, 4)
  assert.equal(h.players.size, 0)
})
