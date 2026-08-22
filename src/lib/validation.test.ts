import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isGameVariant,
  isScoreCategory,
  parseCreateGameBody,
  parseDieIndex,
  parseMaxPlayers,
  parseRoomId,
} from './validation'

describe('validation', () => {
  it('valide les payloads de création de partie', () => {
    assert.deepEqual(parseCreateGameBody({ id: 'AB3K9XY2', variant: 'classic' }), {
      id: 'AB3K9XY2',
      variant: 'classic',
    })
    assert.equal(parseCreateGameBody({ id: '../bad', variant: 'classic' }), null)
    assert.equal(parseCreateGameBody({ id: 'AB3K9XY2', variant: 'unknown' }), null)
  })

  it('valide les primitives réseau', () => {
    assert.equal(parseRoomId('AB3K9XY2'), 'AB3K9XY2')
    assert.equal(parseRoomId('bad room'), null)
    assert.equal(parseDieIndex(4), 4)
    assert.equal(parseDieIndex(5), null)
    assert.equal(parseMaxPlayers(8), 8)
    assert.equal(parseMaxPlayers(9), null)
  })

  it('valide les unions métier', () => {
    assert.equal(isGameVariant('ascending'), true)
    assert.equal(isGameVariant('reverse'), false)
    assert.equal(isScoreCategory('fullHouse'), true)
    assert.equal(isScoreCategory('full_house'), false)
  })
})
