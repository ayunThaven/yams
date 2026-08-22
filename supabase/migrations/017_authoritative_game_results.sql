-- Authoritative game finalization.
-- This migration is incremental and safe to apply after migration 016.

CREATE TABLE IF NOT EXISTS public.game_players (
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.game_results (
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  won BOOLEAN NOT NULL,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  yams_count INTEGER NOT NULL DEFAULT 0 CHECK (yams_count >= 0),
  xp_gained INTEGER NOT NULL DEFAULT 0,
  score_sheet JSONB NOT NULL DEFAULT '{}'::jsonb,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON public.game_players(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON public.game_results(user_id, finalized_at DESC);

CREATE OR REPLACE FUNCTION public.finalize_game(
  p_game_id TEXT,
  p_results JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result RECORD;
  v_inserted_user_id UUID;
  v_current_streak INTEGER;
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_gained INTEGER;
  v_winner TEXT;
  v_processed UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'p_results must be a JSON array';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id) THEN
    RAISE EXCEPTION 'game % does not exist', p_game_id;
  END IF;

  FOR v_result IN
    SELECT *
    FROM jsonb_to_recordset(p_results) AS result(
      user_id UUID,
      player_name TEXT,
      score INTEGER,
      won BOOLEAN,
      abandoned BOOLEAN,
      yams_count INTEGER,
      score_sheet JSONB
    )
  LOOP
    IF v_result.user_id IS NULL OR v_result.player_name IS NULL OR v_result.score IS NULL
      OR v_result.won IS NULL OR v_result.abandoned IS NULL THEN
      RAISE EXCEPTION 'each result must include user_id, player_name, score, won and abandoned';
    END IF;

    IF v_result.score < 0 OR COALESCE(v_result.yams_count, 0) < 0 THEN
      RAISE EXCEPTION 'score and yams_count must be positive';
    END IF;

    INSERT INTO public.game_players (game_id, user_id, player_name, abandoned, left_at)
    VALUES (p_game_id, v_result.user_id, v_result.player_name, v_result.abandoned,
      CASE WHEN v_result.abandoned THEN NOW() ELSE NULL END)
    ON CONFLICT (game_id, user_id) DO UPDATE
      SET player_name = EXCLUDED.player_name,
          abandoned = EXCLUDED.abandoned,
          left_at = COALESCE(public.game_players.left_at, EXCLUDED.left_at);

    SELECT serie_victoires_actuelle, COALESCE(xp, 0), COALESCE(level, 1)
      INTO v_current_streak, v_current_xp, v_current_level
      FROM public.users
      WHERE id = v_result.user_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'user % does not exist', v_result.user_id;
    END IF;

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

    INSERT INTO public.game_results (
      game_id, user_id, player_name, score, won, abandoned, yams_count,
      xp_gained, score_sheet
    ) VALUES (
      p_game_id, v_result.user_id, v_result.player_name, v_result.score,
      v_result.won, v_result.abandoned, COALESCE(v_result.yams_count, 0),
      v_xp_gained, COALESCE(v_result.score_sheet, '{}'::jsonb)
    ) ON CONFLICT (game_id, user_id) DO NOTHING
      RETURNING user_id INTO v_inserted_user_id;

    IF v_inserted_user_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.users
      SET parties_jouees = parties_jouees + 1,
          parties_gagnees = parties_gagnees + CASE WHEN v_result.won THEN 1 ELSE 0 END,
          parties_abandonnees = parties_abandonnees + CASE WHEN v_result.abandoned THEN 1 ELSE 0 END,
          meilleur_score = GREATEST(meilleur_score, v_result.score),
          nombre_yams_realises = nombre_yams_realises + COALESCE(v_result.yams_count, 0),
          serie_victoires_actuelle = CASE
            WHEN v_result.won THEN v_current_streak + 1
            WHEN v_result.abandoned THEN v_current_streak
            ELSE 0
          END,
          meilleure_serie_victoires = GREATEST(
            meilleure_serie_victoires,
            CASE WHEN v_result.won THEN v_current_streak + 1 ELSE v_current_streak END
          ),
          xp = v_new_xp,
          level = v_new_level,
          updated_at = NOW()
      WHERE id = v_result.user_id;

    v_processed := array_append(v_processed, v_result.user_id);
    IF v_result.won AND v_winner IS NULL THEN
      v_winner := v_result.player_name;
    END IF;
  END LOOP;

  UPDATE public.games
    SET status = 'finished',
        winner = v_winner,
        players_scores = p_results,
        updated_at = NOW()
    WHERE id = p_game_id;

  RETURN jsonb_build_object('processed_user_ids', to_jsonb(v_processed));
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_game(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_game(TEXT, JSONB) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.update_user_stats(uuid,integer,boolean,boolean,integer,integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.update_user_stats(uuid,integer,boolean,boolean,integer,integer) FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.unlock_achievement(uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.unlock_achievement(uuid,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid,text) TO service_role';
  END IF;
END;
$$;
