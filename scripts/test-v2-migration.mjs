import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const container = process.env.TEST_DATABASE_CONTAINER
if (container) throw new Error('Use local PostgreSQL 17 through TEST_DATABASE_URL; container execution is disabled.')
const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for the disposable PostgreSQL test database.')
}
let parsed
try { parsed = new URL(databaseUrl) } catch {
  throw new Error('Invalid TEST_DATABASE_URL.')
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    || parsed.pathname !== '/yams_v2_test' || parsed.search || parsed.hash) {
  throw new Error('SQL tests require a local database named yams_v2_test.')
}

const files = {
  fixture: resolve('tests/sql/v2_fixture.sql'),
  guestMigration: resolve('supabase/migrations/029_guest_mode.sql'),
  guestAssertions: resolve('tests/sql/guest_assertions.sql'),
  migration: resolve('supabase/migrations/028_v2_foundations.sql'),
  assertions: resolve('tests/sql/v2_assertions.sql'),
  concurrentSetup: resolve('tests/sql/v2_concurrent_setup.sql'),
  concurrentAssertions: resolve('tests/sql/v2_concurrent_assertions.sql'),
  orphan: resolve('tests/sql/v2_orphan.sql'),
}
// Never inherit libpq routing (PGHOSTADDR, PGSERVICE, etc.) or psql shell hooks.
const pgEnv = {
  PATH: process.env.PATH,
  LANG: 'C.UTF-8',
  PGHOST: parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname.replace(/[\[\]]/g, ''),
  PGPORT: parsed.port || '5432',
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.slice(1),
  PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c client_min_messages=warning -c statement_timeout=30000 -c lock_timeout=10000',
  PGPASSFILE: '/dev/null',
}

const executable = 'psql'

function runFile(file, oldAuthFk) {
  const result = spawnSync(executable, ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-v', `old_auth_fk=${oldAuthFk}`, '-f', '-'], {
    input: readFileSync(file), stdio: ['pipe', 'inherit', 'inherit'], env: pgEnv,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('SQL fixture, migration or assertion failed.')
}

async function runConcurrentFinalization() {
  const payload = JSON.stringify([
    { user_id: '00000000-0000-0000-0000-000000000003', player_name: 'Julie', score: 60,
      won: true, abandoned: false, yams_count: 0, yams_faces: [], score_sheet: {}, reason: 'completed' },
    { user_id: '00000000-0000-0000-0000-000000000002', player_name: 'Brian', score: 50,
      won: false, abandoned: false, yams_count: 0, yams_faces: [], score_sheet: {}, reason: 'completed' },
  ])
  // Hold the game lock until commit so the competing session must wait.
  const statement = `BEGIN; SELECT public.finalize_game('GAMEC001', '${payload}'::jsonb); SELECT pg_sleep(1); COMMIT;`
  const call = () => new Promise((resolveCall, rejectCall) => {
    const child = spawn(executable, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...pgEnv, PGAPPNAME: 'yams-v2-finalize' },
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', rejectCall)
    child.on('close', (code) => code === 0 ? resolveCall() : rejectCall(new Error(stderr)))
  })
  const calls = Promise.allSettled([call(), call()])
  let observedLockWait = false
  for (let attempt = 0; attempt < 50; attempt++) {
    const probe = spawnSync(executable, ['-X', '-w', '-qAt', '-c',
      "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'yams-v2-finalize' AND wait_event_type = 'Lock')"],
    { encoding: 'utf8', env: pgEnv })
    if (probe.status === 0 && probe.stdout.trim() === 't') {
      observedLockWait = true
      break
    }
    await new Promise((resume) => setTimeout(resume, 50))
  }
  const results = await calls
  for (const result of results) if (result.status === 'rejected') throw result.reason
  if (!observedLockWait) throw new Error('Concurrency scenario did not observe a competing lock wait.')
}

// Check the server before the first destructive fixture operation.
const version = spawnSync(executable, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c',
  "SELECT current_database() = 'yams_v2_test' AND current_setting('server_version_num')::int BETWEEN 170000 AND 179999"],
{ encoding: 'utf8', env: pgEnv })
if (version.error) throw version.error
if (version.status !== 0 || version.stdout.trim() !== 't') {
  throw new Error('A disposable PostgreSQL 17 database named yams_v2_test is required.')
}

try {
  for (const oldAuthFk of ['1', '0']) {
    process.stdout.write(`Testing V2 migration with ${oldAuthFk === '1' ? 'auth.users' : 'public.users'} legacy FKs\n`)
    for (const file of [files.fixture, files.migration, files.migration, files.assertions]) {
      runFile(file, oldAuthFk)
    }
    runFile(files.concurrentSetup, oldAuthFk)
    await runConcurrentFinalization()
    runFile(files.concurrentAssertions, oldAuthFk)
    runFile(files.guestMigration, oldAuthFk)
    runFile(files.guestMigration, oldAuthFk)
    runFile(files.guestAssertions, oldAuthFk)
    runFile(files.concurrentSetup, oldAuthFk)
    await runConcurrentFinalization()
    runFile(files.concurrentAssertions, oldAuthFk)
  }

  // An active legacy game without a recoverable owner must stop deployment.
  runFile(files.fixture, '1')
  runFile(files.orphan, '1')
  const orphanCheck = spawnSync(executable, ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: readFileSync(files.migration), encoding: 'utf8', env: pgEnv,
  })
  if (orphanCheck.error) throw orphanCheck.error
  if (orphanCheck.status === 0
      || !orphanCheck.stderr.includes('Active games without a valid owner')) {
    throw new Error(`Expected migration to reject an active ownerless game: ${orphanCheck.stderr}`)
  }
  process.stdout.write('Active ownerless game correctly rejected\n')

} finally {
  // Leave no scenario data behind, including after an expected migration failure.
  const cleanup = spawnSync(executable, ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
    'DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'],
  { stdio: ['ignore', 'inherit', 'inherit'], env: pgEnv })
  if (cleanup.error) throw cleanup.error
  if (cleanup.status !== 0) throw new Error('Disposable SQL test cleanup failed.')
}
