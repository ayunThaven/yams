-- Repair legacy databases where migration 020 was not applied (or was marked
-- as applied without changing the table). finalize_game writes games.updated_at.

ALTER TABLE IF EXISTS public.games
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.games
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Ensure the timestamp continues to be maintained for direct game updates.
DROP TRIGGER IF EXISTS set_games_updated_at ON public.games;
CREATE TRIGGER set_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
