-- Some pre-existing deployments created public.games before the updated_at
-- column was introduced. Finalize_game updates this timestamp, so make the
-- schema compatible before any finalization can run.

ALTER TABLE IF EXISTS public.games
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.games
  SET updated_at = COALESCE(updated_at, created_at, NOW())
  WHERE updated_at IS NULL;
