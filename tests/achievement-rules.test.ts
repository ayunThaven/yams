import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  AUTOMATIC_ACHIEVEMENT_IDS,
  FINALIZATION_ACHIEVEMENT_IDS,
  INACTIVE_ACHIEVEMENT_IDS,
  MANUAL_ACHIEVEMENT_IDS,
  getFinalizationAchievementIds,
} from '../src/server/achievementRules'
import { createEmptyScoreSheet } from '../src/lib/yamsLogic'

function completeUpperSection() {
  const scoreSheet = createEmptyScoreSheet()
  scoreSheet.ones = 3
  scoreSheet.twos = 6
  scoreSheet.threes = 9
  scoreSheet.fours = 12
  scoreSheet.fives = 15
  scoreSheet.sixes = 18
  return scoreSheet
}

test('every catalogue achievement has an automatic, manual, or inactive disposition', () => {
  const bootstrap = readFileSync(
    resolve(process.cwd(), 'supabase/bootstrap/reset-public-schema.sql'),
    'utf8'
  )
  const catalogueSection = bootstrap.slice(bootstrap.indexOf('INSERT INTO public.achievements'))
  const catalogueIds = [...catalogueSection.matchAll(/^\('([^']+)'/gm)].map((match) => match[1])
  const dispositions = [
    ...AUTOMATIC_ACHIEVEMENT_IDS,
    ...MANUAL_ACHIEVEMENT_IDS,
    ...INACTIVE_ACHIEVEMENT_IDS,
  ]

  assert.equal(new Set(dispositions).size, dispositions.length, 'achievement dispositions must not overlap')
  assert.deepEqual([...dispositions].sort(), catalogueIds.sort())
  assert.deepEqual(MANUAL_ACHIEVEMENT_IDS, ['bug_finder'])
})

test('all finalization achievements are reachable by supported game outcomes', () => {
  const winningIds = getFinalizationAchievementIds({
    result: {
      score: 375,
      won: true,
      abandoned: false,
      yams_count: 1,
      yams_faces: [1, 2, 3, 4, 5, 6],
      score_sheet: completeUpperSection(),
    },
    profile: {
      level: 50,
      parties_jouees: 10,
      parties_gagnees: 8,
      serie_victoires_actuelle: 10,
    },
    variant: 'ascending',
    leaderboardRank: 1,
  })
  const losingIds = getFinalizationAchievementIds({
    result: {
      score: 100,
      won: false,
      abandoned: false,
      yams_count: 0,
      yams_faces: [],
      score_sheet: createEmptyScoreSheet(),
    },
    profile: {
      level: 1,
      parties_jouees: 1,
      parties_gagnees: 0,
      serie_victoires_actuelle: 0,
    },
    variant: 'descending',
    leaderboardRank: null,
  })
  const abandonedIds = getFinalizationAchievementIds({
    result: {
      score: 0,
      won: false,
      abandoned: true,
      yams_count: 0,
      yams_faces: [],
      score_sheet: createEmptyScoreSheet(),
    },
    profile: {
      level: 1,
      parties_jouees: 1,
      parties_gagnees: 0,
      serie_victoires_actuelle: 0,
    },
    variant: 'classic',
    leaderboardRank: null,
  })

  const reachableIds = new Set([...winningIds, ...losingIds, ...abandonedIds])
  assert.deepEqual([...reachableIds].sort(), [...FINALIZATION_ACHIEVEMENT_IDS].sort())
  assert.equal(losingIds.includes('loose_game'), true)
  assert.equal(abandonedIds.includes('loose_game'), false)
})
