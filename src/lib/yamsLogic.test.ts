import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateScore,
  calculateTotalScore,
  createEmptyScoreSheet,
  isScoreSheetComplete,
} from './yamsLogic'

describe('yamsLogic', () => {
  it('calcule les combinaisons principales', () => {
    assert.equal(calculateScore('threeOfKind', [2, 2, 2, 4, 5]), 15)
    assert.equal(calculateScore('fourOfKind', [6, 6, 6, 6, 1]), 25)
    assert.equal(calculateScore('fullHouse', [3, 3, 3, 5, 5]), 25)
    assert.equal(calculateScore('smallStraight', [1, 2, 3, 4, 6]), 30)
    assert.equal(calculateScore('largeStraight', [2, 3, 4, 5, 6]), 40)
    assert.equal(calculateScore('yams', [4, 4, 4, 4, 4]), 50)
  })

  it('ajoute le bonus supérieur à partir de 63 points', () => {
    const scoreSheet = createEmptyScoreSheet()
    scoreSheet.ones = 3
    scoreSheet.twos = 6
    scoreSheet.threes = 9
    scoreSheet.fours = 12
    scoreSheet.fives = 15
    scoreSheet.sixes = 18

    assert.equal(calculateTotalScore(scoreSheet), 98)
  })

  it('détecte une feuille complète', () => {
    const scoreSheet = createEmptyScoreSheet()
    assert.equal(isScoreSheetComplete(scoreSheet), false)

    for (const category of Object.keys(scoreSheet) as Array<keyof typeof scoreSheet>) {
      scoreSheet[category] = 0
    }

    assert.equal(isScoreSheetComplete(scoreSheet), true)
  })
})
