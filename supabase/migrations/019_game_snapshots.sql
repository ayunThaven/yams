CREATE TABLE IF NOT EXISTS public.game_snapshots (
  game_id TEXT PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  turn_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_snapshots_updated_at ON public.game_snapshots(updated_at DESC);

CREATE OR REPLACE FUNCTION public.save_game_snapshot(
  p_game_id TEXT,
  p_state JSONB,
  p_expected_version INTEGER,
  p_turn_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version INTEGER;
BEGIN
  UPDATE public.game_snapshots
    SET state = p_state,
        version = version + 1,
        turn_expires_at = p_turn_expires_at,
        updated_at = NOW()
    WHERE game_id = p_game_id AND version = p_expected_version
    RETURNING version INTO v_version;

  IF v_version IS NOT NULL THEN RETURN v_version; END IF;

  IF p_expected_version = 0 THEN
    INSERT INTO public.game_snapshots (game_id, state, turn_expires_at)
    VALUES (p_game_id, p_state, p_turn_expires_at)
    RETURNING version INTO v_version;
    RETURN v_version;
  END IF;

  RAISE EXCEPTION 'snapshot version conflict for game %', p_game_id USING ERRCODE = '40001';
END;
$$;

REVOKE ALL ON FUNCTION public.save_game_snapshot(TEXT, JSONB, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_game_snapshot(TEXT, JSONB, INTEGER, TIMESTAMPTZ) TO service_role;
