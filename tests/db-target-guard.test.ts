import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('SQL harness rejects unsafe targets before starting psql and never logs the URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yams-db-guard-'))
  try {
    const marker = join(dir, 'called.json')
    writeFileSync(join(dir, 'psql'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify(process.env)); process.exit(1)\n`, { mode: 0o700 })
    const run = (url: string, extra = {}) => spawnSync(process.execPath, [resolve('scripts/test-v2-migration.mjs')], {
      encoding: 'utf8', env: { NODE_ENV: 'test', PATH: dir, TEST_DATABASE_URL: url, ...extra },
    })
    for (const url of [
      '', 'not-a-url-password-sentinel',
      'postgres://postgres:password-sentinel@remote.invalid/yams_v2_test',
      'postgres://postgres:password-sentinel@127.0.0.1/postgres',
      'https://postgres:password-sentinel@127.0.0.1/yams_v2_test',
      'postgres://postgres:password-sentinel@127.0.0.1/yams_v2_test?host=remote.invalid',
      'postgres://postgres:password-sentinel@127.0.0.1/yams_v2_test#ignored',
    ]) {
      const result = run(url)
      assert.notEqual(result.status, 0)
      assert.doesNotMatch(result.stderr, /password-sentinel/)
      assert.throws(() => readFileSync(marker), { code: 'ENOENT' })
    }
    const local = 'postgres://postgres:dummy@127.0.0.1/yams_v2_test'
    assert.notEqual(run(local, { TEST_DATABASE_CONTAINER: 'yams-phase1-sql-test' }).status, 0)
    assert.throws(() => readFileSync(marker), { code: 'ENOENT' })
    const result = run(local, { PGHOSTADDR: 'remote.invalid', PGSERVICE: 'production', PGSERVICEFILE: '/unsafe', PGOPTIONS: 'unsafe' })
    assert.notEqual(result.status, 0)
    const env = JSON.parse(readFileSync(marker, 'utf8'))
    assert.equal(env.PGHOST, '127.0.0.1')
    assert.equal(env.PGDATABASE, 'yams_v2_test')
    for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE']) assert.equal(env[key], undefined)
    assert.match(env.PGOPTIONS, /statement_timeout=30000/)
    assert.match(result.stderr, /PostgreSQL 17/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
