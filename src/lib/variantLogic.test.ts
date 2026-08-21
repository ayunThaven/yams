import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canChooseCategory, getNextCategory } from './variantLogic'
import { createEmptyScoreSheet } from './yamsLogic'

describe('variantLogic', () => {
  it('la variante classique autorise toute catégorie vide', () => {
    const scoreSheet = createEmptyScoreSheet()

    assert.equal(canChooseCategory('classic', 'chance', scoreSheet), true)
    scoreSheet.chance = 12
    assert.equal(canChooseCategory('classic', 'chance', scoreSheet), false)
  })

  it('la variante descendante impose l’ordre haut vers bas', () => {
    const scoreSheet = createEmptyScoreSheet()

    assert.equal(getNextCategory('descending', scoreSheet), 'ones')
    assert.equal(canChooseCategory('descending', 'twos', scoreSheet), false)

    scoreSheet.ones = 3
    assert.equal(getNextCategory('descending', scoreSheet), 'twos')
    assert.equal(canChooseCategory('descending', 'twos', scoreSheet), true)
  })

  it('la variante montante impose l’ordre bas vers haut', () => {
    const scoreSheet = createEmptyScoreSheet()

    assert.equal(getNextCategory('ascending', scoreSheet), 'chance')
    assert.equal(canChooseCategory('ascending', 'yams', scoreSheet), false)

    scoreSheet.chance = 20
    assert.equal(getNextCategory('ascending', scoreSheet), 'yams')
    assert.equal(canChooseCategory('ascending', 'yams', scoreSheet), true)
  })
})
