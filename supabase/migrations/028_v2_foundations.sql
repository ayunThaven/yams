-- V2 phase 0. This migration retains historical rows and exposes no new route.
BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ,
  CONSTRAINT guest_sessions_expiry_check CHECK (expires_at > created_at)
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.protect_guest_session_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'guest session identity and expiration are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_guest_session_expiry ON public.guest_sessions;
CREATE TRIGGER protect_guest_session_expiry BEFORE UPDATE ON public.guest_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_guest_session_expiry();

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'CASUAL',
  ADD COLUMN IF NOT EXISTS guest_owner_session_id UUID,
  ADD COLUMN IF NOT EXISTS legacy_hostless BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.games SET visibility = 'PRIVATE' WHERE visibility IS NULL;
UPDATE public.games SET match_type = 'CASUAL' WHERE match_type IS NULL;
ALTER TABLE public.games ALTER COLUMN visibility SET NOT NULL;
ALTER TABLE public.games ALTER COLUMN match_type SET NOT NULL;

-- Historical deployments have targeted either auth.users or public.users, and
-- host_id once used ON DELETE CASCADE. Inspect the actual constraints by column.
DO $$
DECLARE v_fk RECORD;
BEGIN
  FOR v_fk IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.games'::regclass AND c.contype = 'f'
      AND array_length(c.conkey, 1) = 1 AND a.attname IN ('owner', 'host_id')
  LOOP
    RAISE NOTICE 'Replacing games FK %: %', v_fk.conname, v_fk.definition;
    EXECUTE format('ALTER TABLE public.games DROP CONSTRAINT %I', v_fk.conname);
  END LOOP;
END $$;

-- A removed account may have left an owner UUID that no longer exists in the
-- application's identity table. Only a valid host_id is a reliable fallback.
UPDATE public.games g SET owner = NULL
WHERE g.owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = g.owner);

UPDATE public.games g SET owner = g.host_id
WHERE g.owner IS NULL AND g.guest_owner_session_id IS NULL AND g.host_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = g.host_id);

UPDATE public.games g SET host_id = NULL
WHERE g.host_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = g.host_id);

DO $$
DECLARE v_invalid TEXT;
BEGIN
  SELECT string_agg(id, ', ') INTO v_invalid FROM (
    SELECT id FROM public.games
    WHERE status IS DISTINCT FROM 'finished' AND owner IS NULL AND guest_owner_session_id IS NULL
    ORDER BY id LIMIT 20
  ) AS active_without_owner;
  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION 'Active games without a valid owner must be repaired before V2 migration: %', v_invalid;
  END IF;
END $$;

UPDATE public.games
SET legacy_hostless = TRUE
WHERE status = 'finished' AND owner IS NULL AND guest_owner_session_id IS NULL
  AND legacy_hostless IS FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.games'::regclass AND conname = 'games_visibility_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_visibility_check CHECK (visibility IN ('PRIVATE', 'PUBLIC'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.games'::regclass AND conname = 'games_match_type_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_match_type_check CHECK (match_type IN ('CASUAL', 'RANKED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.games'::regclass AND conname = 'games_owner_identity_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_owner_identity_check CHECK (
      (legacy_hostless AND status = 'finished' AND owner IS NULL AND guest_owner_session_id IS NULL)
      OR (NOT legacy_hostless AND num_nonnulls(owner, guest_owner_session_id) = 1)
    );
  END IF;
END $$;

ALTER TABLE public.games
  ADD CONSTRAINT games_owner_users_fk FOREIGN KEY (owner) REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT games_host_users_fk FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.games'::regclass AND conname = 'games_guest_owner_fk') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_guest_owner_fk
      FOREIGN KEY (guest_owner_session_id) REFERENCES public.guest_sessions(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_legacy_hostless()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.legacy_hostless)
     OR (TG_OP = 'UPDATE' AND NOT OLD.legacy_hostless AND NEW.legacy_hostless) THEN
    RAISE EXCEPTION 'legacy_hostless is reserved for migration of finished games';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_legacy_hostless ON public.games;
CREATE TRIGGER protect_legacy_hostless BEFORE INSERT OR UPDATE OF legacy_hostless ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.protect_legacy_hostless();

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS guest_session_id UUID;
UPDATE public.game_players SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.game_players ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND conname = 'game_players_game_user_key') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_game_user_key UNIQUE (game_id, user_id);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.game_players'::regclass AND c.contype = 'p' AND a.attname = 'game_id'
  ) THEN
    ALTER TABLE public.game_players DROP CONSTRAINT game_players_pkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND contype = 'p') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND conname = 'game_players_id_game_key') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_id_game_key UNIQUE (id, game_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND conname = 'game_players_game_guest_key') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_game_guest_key UNIQUE (game_id, guest_session_id);
  END IF;
END $$;

ALTER TABLE public.game_players ALTER COLUMN user_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND conname = 'game_players_identity_check') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_identity_check
      CHECK (num_nonnulls(user_id, guest_session_id) = 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_players'::regclass AND conname = 'game_players_guest_fk') THEN
    ALTER TABLE public.game_players ADD CONSTRAINT game_players_guest_fk
      FOREIGN KEY (guest_session_id) REFERENCES public.guest_sessions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Existing score actions can belong to games that have not yet finished.
INSERT INTO public.game_players (game_id, user_id, player_name)
SELECT DISTINCT ON (game_id, user_id) game_id, user_id, player_name
FROM public.game_results WHERE user_id IS NOT NULL
ORDER BY game_id, user_id, finalized_at
ON CONFLICT (game_id, user_id) DO NOTHING;

INSERT INTO public.game_players (game_id, user_id, player_name)
SELECT DISTINCT ON (game_id, user_id) game_id, user_id, player_name
FROM public.game_score_actions WHERE user_id IS NOT NULL
ORDER BY game_id, user_id, created_at
ON CONFLICT (game_id, user_id) DO NOTHING;

ALTER TABLE public.game_results ADD COLUMN IF NOT EXISTS game_player_id UUID;
UPDATE public.game_results r SET game_player_id = p.id
FROM public.game_players p
WHERE r.game_player_id IS NULL AND p.game_id = r.game_id AND p.user_id = r.user_id;
ALTER TABLE public.game_results ALTER COLUMN game_player_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_results'::regclass AND conname = 'game_results_game_user_key') THEN
    ALTER TABLE public.game_results ADD CONSTRAINT game_results_game_user_key UNIQUE (game_id, user_id);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.game_results'::regclass AND c.contype = 'p' AND a.attname = 'game_id'
  ) THEN
    ALTER TABLE public.game_results DROP CONSTRAINT game_results_pkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_results'::regclass AND contype = 'p') THEN
    ALTER TABLE public.game_results ADD CONSTRAINT game_results_pkey PRIMARY KEY (game_player_id);
  END IF;
END $$;

ALTER TABLE public.game_results ALTER COLUMN user_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_results'::regclass AND conname = 'game_results_player_game_fk') THEN
    ALTER TABLE public.game_results ADD CONSTRAINT game_results_player_game_fk
      FOREIGN KEY (game_player_id, game_id) REFERENCES public.game_players(id, game_id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.game_score_actions ADD COLUMN IF NOT EXISTS game_player_id UUID;
UPDATE public.game_score_actions a SET game_player_id = p.id
FROM public.game_players p
WHERE a.game_player_id IS NULL AND p.game_id = a.game_id AND p.user_id = a.user_id;
ALTER TABLE public.game_score_actions ALTER COLUMN game_player_id SET NOT NULL;
ALTER TABLE public.game_score_actions ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_score_actions'::regclass AND conname = 'game_score_actions_player_category_key') THEN
    ALTER TABLE public.game_score_actions ADD CONSTRAINT game_score_actions_player_category_key UNIQUE (game_player_id, category);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.game_score_actions'::regclass AND conname = 'game_score_actions_player_game_fk') THEN
    ALTER TABLE public.game_score_actions ADD CONSTRAINT game_score_actions_player_game_fk
      FOREIGN KEY (game_player_id, game_id) REFERENCES public.game_players(id, game_id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Identity changes would make compatibility mirrors and historical references
-- stale. Conversion to an account will link identities, not rewrite this row.
CREATE OR REPLACE FUNCTION public.protect_game_player_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.game_id IS DISTINCT FROM OLD.game_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.guest_session_id IS DISTINCT FROM OLD.guest_session_id THEN
    RAISE EXCEPTION 'game player identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_game_player_identity ON public.game_players;
CREATE TRIGGER protect_game_player_identity BEFORE UPDATE ON public.game_players
  FOR EACH ROW EXECUTE FUNCTION public.protect_game_player_identity();

-- The retained user_id columns are read-compatibility mirrors, never another
-- authority for participant identity. A direct table write cannot diverge.
CREATE OR REPLACE FUNCTION public.sync_game_player_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.game_players
  WHERE id = NEW.game_player_id AND game_id = NEW.game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'game player % does not belong to game %', NEW.game_player_id, NEW.game_id;
  END IF;
  NEW.user_id := v_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_game_results_user_id ON public.game_results;
CREATE TRIGGER sync_game_results_user_id BEFORE INSERT OR UPDATE ON public.game_results
  FOR EACH ROW EXECUTE FUNCTION public.sync_game_player_user_id();
DROP TRIGGER IF EXISTS sync_game_score_actions_user_id ON public.game_score_actions;
CREATE TRIGGER sync_game_score_actions_user_id BEFORE INSERT OR UPDATE ON public.game_score_actions
  FOR EACH ROW EXECUTE FUNCTION public.sync_game_player_user_id();

-- Normalize all account FKs capable of cascading away game history. The
-- historical game_player_results table is deprecated but still retained.
DO $$
DECLARE v_table REGCLASS; v_column TEXT; v_fk RECORD;
BEGIN
  FOR v_table, v_column IN
    SELECT 'public.game_players'::regclass, 'user_id' UNION ALL
    SELECT 'public.game_results'::regclass, 'user_id' UNION ALL
    SELECT 'public.game_score_actions'::regclass, 'user_id' UNION ALL
    SELECT to_regclass('public.game_player_results'), 'user_id'
  LOOP
    IF v_table IS NULL THEN CONTINUE; END IF;
    FOR v_fk IN
      SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.conrelid = v_table AND c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND a.attname = v_column
    LOOP
      RAISE NOTICE 'Replacing % FK %: %', v_table, v_fk.conname, v_fk.definition;
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_table, v_fk.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT',
      v_table, replace(v_table::text, '.', '_') || '_user_restrict_fk');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_user_game_player(p_game_id TEXT, p_user_id UUID, p_player_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id is required'; END IF;
  INSERT INTO public.game_players(game_id, user_id, player_name)
  VALUES (p_game_id, p_user_id, p_player_name)
  ON CONFLICT (game_id, user_id) DO NOTHING;
  SELECT id INTO STRICT v_id FROM public.game_players WHERE game_id = p_game_id AND user_id = p_user_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_user_game_player(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_game_player(TEXT, UUID, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.user_ratings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  mu NUMERIC(12,6) NOT NULL,
  sigma NUMERIC(12,6) NOT NULL CHECK (sigma > 0),
  games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0 AND wins <= games_played),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 8),
  player_count INTEGER NOT NULL CHECK (player_count BETWEEN 2 AND 8 AND position <= player_count),
  mu_before NUMERIC(12,6) NOT NULL,
  sigma_before NUMERIC(12,6) NOT NULL CHECK (sigma_before > 0),
  mu_after NUMERIC(12,6) NOT NULL,
  sigma_after NUMERIC(12,6) NOT NULL CHECK (sigma_after > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id),
  CONSTRAINT rating_history_participant_fk FOREIGN KEY (game_id, user_id)
    REFERENCES public.game_players(game_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user_created ON public.rating_history(user_id, created_at DESC);
DROP TRIGGER IF EXISTS set_user_ratings_updated_at ON public.user_ratings;
CREATE TRIGGER set_user_ratings_updated_at BEFORE UPDATE ON public.user_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_ratings, public.rating_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ratings, public.rating_history TO service_role;

-- Keep the existing RPC signatures. The participant ID is resolved on the
-- server, and score action plus snapshot still commit in one transaction.
CREATE OR REPLACE FUNCTION public.record_score_action_and_snapshot(
  p_game_id TEXT, p_user_id UUID, p_player_name TEXT, p_turn_number INTEGER,
  p_category TEXT, p_dice_values SMALLINT[], p_score INTEGER, p_total_after INTEGER,
  p_yams_face SMALLINT, p_state JSONB, p_expected_version INTEGER,
  p_turn_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_version INTEGER; v_player_id UUID;
BEGIN
  v_player_id := public.ensure_user_game_player(p_game_id, p_user_id, p_player_name);
  INSERT INTO public.game_score_actions(
    game_id, game_player_id, user_id, player_name, turn_number, category,
    dice_values, score, total_after, yams_face
  ) VALUES (
    p_game_id, v_player_id, p_user_id, p_player_name, p_turn_number, p_category,
    p_dice_values, p_score, p_total_after, p_yams_face
  ) ON CONFLICT (game_id, user_id, category) DO NOTHING;
  SELECT public.save_game_snapshot(p_game_id, p_state, p_expected_version, p_turn_expires_at) INTO v_version;
  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_canonical_game_result(
  p_game_id TEXT, p_user_id UUID, p_player_name TEXT, p_score INTEGER,
  p_won BOOLEAN, p_abandoned BOOLEAN, p_yams_count INTEGER,
  p_yams_faces SMALLINT[], p_xp_gained INTEGER, p_score_sheet JSONB, p_reason TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted UUID; v_player_id UUID;
BEGIN
  -- Serialize an early abandon with a simultaneous whole-game finalization.
  PERFORM 1 FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game % does not exist', p_game_id; END IF;
  v_player_id := public.ensure_user_game_player(p_game_id, p_user_id, p_player_name);
  IF p_abandoned THEN
    UPDATE public.game_players SET abandoned = TRUE, left_at = COALESCE(left_at, NOW())
    WHERE id = v_player_id AND NOT abandoned;
  END IF;
  INSERT INTO public.game_results(
    game_id, game_player_id, user_id, player_name, score, won, abandoned,
    yams_count, yams_faces, xp_gained, score_sheet, reason
  ) VALUES (
    p_game_id, v_player_id, p_user_id, p_player_name, p_score, p_won, p_abandoned,
    p_yams_count, COALESCE(p_yams_faces, '{}'), p_xp_gained,
    COALESCE(p_score_sheet, '{}'), p_reason
  ) ON CONFLICT (game_id, user_id) DO NOTHING RETURNING game_player_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN FALSE; END IF;
  PERFORM public.update_user_stats(p_user_id, p_score, p_won, p_abandoned, p_yams_count, p_xp_gained);
  RETURN TRUE;
END;
$$;

-- Result insertion is the idempotency gate for statistics and XP. A finished
-- status suppresses only the metadata transition, never missing result rows.
CREATE OR REPLACE FUNCTION public.finalize_game(p_game_id TEXT, p_results JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_result RECORD;
  v_player_id UUID;
  v_inserted_player_id UUID;
  v_current_streak INTEGER;
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_gained INTEGER;
  v_winner TEXT;
  v_processed UUID[] := ARRAY[]::UUID[];
  v_first_completion BOOLEAN := FALSE;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'p_results must be a JSON array';
  END IF;
  PERFORM 1 FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game % does not exist', p_game_id; END IF;

  FOR v_result IN
    SELECT * FROM jsonb_to_recordset(p_results) AS result(
      user_id UUID, player_name TEXT, score INTEGER, won BOOLEAN,
      abandoned BOOLEAN, yams_count INTEGER, yams_faces SMALLINT[],
      score_sheet JSONB, reason TEXT
    )
  LOOP
    IF v_result.user_id IS NULL OR v_result.player_name IS NULL OR v_result.score IS NULL
      OR v_result.won IS NULL OR v_result.abandoned IS NULL THEN
      RAISE EXCEPTION 'each result must include user_id, player_name, score, won and abandoned';
    END IF;
    IF v_result.score < 0 OR COALESCE(v_result.yams_count, 0) < 0 THEN
      RAISE EXCEPTION 'score and yams_count must be positive';
    END IF;
    IF v_result.won AND v_winner IS NULL THEN v_winner := v_result.player_name; END IF;

    v_player_id := public.ensure_user_game_player(p_game_id, v_result.user_id, v_result.player_name);
    UPDATE public.game_players SET
      abandoned = abandoned OR v_result.abandoned,
      left_at = CASE WHEN v_result.abandoned THEN COALESCE(left_at, NOW()) ELSE left_at END
    WHERE id = v_player_id AND (v_result.abandoned AND NOT abandoned);

    SELECT serie_victoires_actuelle, COALESCE(xp, 0), COALESCE(level, 1)
      INTO v_current_streak, v_current_xp, v_current_level
      FROM public.users WHERE id = v_result.user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'user % does not exist', v_result.user_id; END IF;

    v_xp_gained := CASE
      WHEN v_result.abandoned THEN -(v_current_level * 10)
      ELSE FLOOR(v_result.score / 10.0)::INTEGER + CASE WHEN v_result.won THEN 25 ELSE 0 END
    END;
    IF v_current_level >= 50 THEN
      v_new_xp := v_current_xp;
      v_new_level := 50;
    ELSE
      v_new_xp := GREATEST(0, v_current_xp + v_xp_gained);
      v_new_level := public.level_from_xp(v_new_xp);
      IF v_new_level >= 50 THEN
        v_new_level := 50;
        v_new_xp := LEAST(v_new_xp, public.xp_for_level(50));
      END IF;
    END IF;

    v_inserted_player_id := NULL;
    INSERT INTO public.game_results(
      game_id, game_player_id, user_id, player_name, score, won, abandoned,
      yams_count, yams_faces, xp_gained, score_sheet, reason
    ) VALUES (
      p_game_id, v_player_id, v_result.user_id, v_result.player_name, v_result.score,
      v_result.won, v_result.abandoned, COALESCE(v_result.yams_count, 0),
      COALESCE(v_result.yams_faces, '{}'), v_xp_gained,
      COALESCE(v_result.score_sheet, '{}'), COALESCE(v_result.reason, 'completed')
    ) ON CONFLICT (game_id, user_id) DO NOTHING
      RETURNING game_player_id INTO v_inserted_player_id;
    IF v_inserted_player_id IS NULL THEN CONTINUE; END IF;

    UPDATE public.users SET
      parties_jouees = parties_jouees + 1,
      parties_gagnees = parties_gagnees + CASE WHEN v_result.won THEN 1 ELSE 0 END,
      parties_abandonnees = parties_abandonnees + CASE WHEN v_result.abandoned THEN 1 ELSE 0 END,
      meilleur_score = GREATEST(meilleur_score, v_result.score),
      nombre_yams_realises = nombre_yams_realises + COALESCE(v_result.yams_count, 0),
      serie_victoires_actuelle = CASE
        WHEN v_result.won THEN v_current_streak + 1
        WHEN v_result.abandoned THEN v_current_streak ELSE 0 END,
      meilleure_serie_victoires = GREATEST(meilleure_serie_victoires,
        CASE WHEN v_result.won THEN v_current_streak + 1 ELSE v_current_streak END),
      xp = v_new_xp, level = v_new_level, updated_at = NOW()
    WHERE id = v_result.user_id;
    v_processed := array_append(v_processed, v_result.user_id);
  END LOOP;

  UPDATE public.games SET status = 'finished', winner = v_winner,
    players_scores = p_results, updated_at = NOW()
  WHERE id = p_game_id AND status IS DISTINCT FROM 'finished';
  v_first_completion := FOUND;
  RETURN jsonb_build_object('processed_user_ids', to_jsonb(v_processed),
    'first_completion', v_first_completion);
END;
$$;

REVOKE ALL ON FUNCTION public.record_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_canonical_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_game(TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_canonical_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_game(TEXT,JSONB) TO service_role;

COMMIT;
