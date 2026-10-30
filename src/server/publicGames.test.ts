import test from 'node:test'
import assert from 'node:assert/strict'
import { sortPublicGames } from './publicGames'

test('public games prioritise remaining seats then oldest table', () => {
  const base = { host: 'H', variant: 'classic', createdAt: '2026-01-02' }
  const games = [
    { ...base, id: 'wide', players: 3, maxPlayers: 8 },
    { ...base, id: 'new', players: 3, maxPlayers: 4 },
    { ...base, id: 'old', players: 1, maxPlayers: 2, createdAt: '2026-01-01' },
  ]
  assert.deepEqual(sortPublicGames(games).map(game => game.id), ['old', 'new', 'wide'])
})
