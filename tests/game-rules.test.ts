import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateScore,
  calculateTotalScore,
  createEmptyScoreSheet,
} from '../src/lib/yamsLogic'
import { canChooseCategory, getNextCategory } from '../src/lib/variantLogic'
import { levelFromXp, xpForLevel } from '../src/lib/userStats'
import { chooseScore, clearAllGames, initializeGame } from '../src/server/gameManager'

test('scores standard Yams combinations correctly', () => {
  assert.equal(calculateScore('fullHouse', [2, 2, 3, 3, 3]), 25)
  assert.equal(calculateScore('smallStraight', [1, 2, 3, 4, 6]), 30)
  assert.equal(calculateScore('largeStraight', [2, 3, 4, 5, 6]), 40)
  assert.equal(calculateScore('yams', [6, 6, 6, 6, 6]), 50)
  assert.equal(calculateScore('fourOfKind', [6, 6, 6, 6, 1]), 25)
})

test('adds the upper-section bonus only at 63 points', () => {
  const scoreSheet = createEmptyScoreSheet()
  scoreSheet.ones = 3
  scoreSheet.twos = 6
  scoreSheet.threes = 9
  scoreSheet.fours = 12
  scoreSheet.fives = 15
  scoreSheet.sixes = 18

  assert.equal(calculateTotalScore(scoreSheet), 98)
})

test('enforces the selected variant category order', () => {
  const scoreSheet = createEmptyScoreSheet()

  assert.equal(getNextCategory('descending', scoreSheet), 'ones')
  assert.equal(canChooseCategory('descending', 'ones', scoreSheet), true)
  assert.equal(canChooseCategory('descending', 'chance', scoreSheet), false)
  assert.equal(getNextCategory('ascending', scoreSheet), 'chance')
})

test('keeps XP progression monotonic and capped at level 50', () => {
  assert.equal(levelFromXp(0), 1)
  assert.equal(levelFromXp(xpForLevel(2)), 2)
  assert.equal(levelFromXp(xpForLevel(50) + 10_000), 50)
})

test('records the face of every Yams rolled when a score is chosen', () => {
  clearAllGames()
  const game = initializeGame('YAMSFACE', [{ id: 'player-1', name: 'Alice' }])
  game.dice = Array.from({ length: 5 }, () => ({ value: 4, locked: false }))

  const updatedGame = chooseScore(game.roomId, 'player-1', 'fours')

  assert.deepEqual(updatedGame?.players[0].yamsFaces, [4])
  clearAllGames()
})
