import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for the disposable PostgreSQL test database.')
}
const parsed = new URL(databaseUrl)
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
    || parsed.pathname !== '/yams_v2_test') {
  throw new Error('SQL tests require a local database named yams_v2_test.')
}

const files = {
  fixture: resolve('tests/sql/v2_fixture.sql'),
  migration: resolve('supabase/migrations/028_v2_foundations.sql'),
  assertions: resolve('tests/sql/v2_assertions.sql'),
  concurrentSetup: resolve('tests/sql/v2_concurrent_setup.sql'),
  concurrentAssertions: resolve('tests/sql/v2_concurrent_assertions.sql'),
  orphan: resolve('tests/sql/v2_orphan.sql'),
}
const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || '5432',
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.slice(1),
  PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c client_min_messages=warning',
}

function runFile(file, oldAuthFk) {
  const result = spawnSync('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-v', `old_auth_fk=${oldAuthFk}`, '-f', file], {
    stdio: 'inherit', env: pgEnv,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runConcurrentFinalization() {
  const payload = JSON.stringify([
    { user_id: '00000000-0000-0000-0000-000000000003', player_name: 'Julie', score: 60,
      won: true, abandoned: false, yams_count: 0, yams_faces: [], score_sheet: {}, reason: 'completed' },
    { user_id: '00000000-0000-0000-0000-000000000002', player_name: 'Brian', score: 50,
      won: false, abandoned: false, yams_count: 0, yams_faces: [], score_sheet: {}, reason: 'completed' },
  ])
  const statement = `SELECT public.finalize_game('GAMEC001', '${payload}'::jsonb)`
  const call = () => new Promise((resolveCall, rejectCall) => {
    const child = spawn('psql', ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], {
      stdio: ['ignore', 'pipe', 'pipe'], env: pgEnv,
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', rejectCall)
    child.on('close', (code) => code === 0 ? resolveCall() : rejectCall(new Error(stderr)))
  })
  return Promise.all([call(), call()])
}

for (const oldAuthFk of ['1', '0']) {
  process.stdout.write(`Testing V2 migration with ${oldAuthFk === '1' ? 'auth.users' : 'public.users'} legacy FKs\n`)
  for (const file of [files.fixture, files.migration, files.migration, files.assertions]) {
    runFile(file, oldAuthFk)
  }
  runFile(files.concurrentSetup, oldAuthFk)
  await runConcurrentFinalization()
  runFile(files.concurrentAssertions, oldAuthFk)
}

// An active legacy game without a recoverable owner must stop deployment.
runFile(files.fixture, '1')
runFile(files.orphan, '1')
const orphanCheck = spawnSync('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-f', files.migration], {
  encoding: 'utf8', env: pgEnv,
})
if (orphanCheck.error) throw orphanCheck.error
if (orphanCheck.status === 0
    || !orphanCheck.stderr.includes('Active games without a valid owner')) {
  throw new Error(`Expected migration to reject an active ownerless game: ${orphanCheck.stderr}`)
}
process.stdout.write('Active ownerless game correctly rejected\n')
