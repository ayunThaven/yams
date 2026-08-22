CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.consume_auth_rate_limit(
  p_bucket TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  IF length(p_bucket) = 0 OR length(p_bucket) > 256 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid rate-limit parameters';
  END IF;

  INSERT INTO public.auth_rate_limits (bucket, attempts, window_started_at)
  VALUES (p_bucket, 1, NOW())
  ON CONFLICT (bucket) DO UPDATE
    SET attempts = CASE
          WHEN public.auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= NOW() THEN 1
          ELSE public.auth_rate_limits.attempts + 1
        END,
        window_started_at = CASE
          WHEN public.auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= NOW() THEN NOW()
          ELSE public.auth_rate_limits.window_started_at
        END
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
