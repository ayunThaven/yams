-- Phase 1: all writes use the canonical participant; old USER RPCs remain compatible.
BEGIN;
-- Canonical identities/results are exposed only through server-authorized flows.
-- This also closes legacy Supabase default grants that could expose guest history.
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_players, public.game_results FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_players, public.game_results TO service_role;

CREATE OR REPLACE FUNCTION public.join_casual_game(p_game_id TEXT, p_user_id UUID, p_guest_session_id UUID, p_player_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_game public.games; v_id UUID; v_name TEXT;
BEGIN
  IF num_nonnulls(p_user_id, p_guest_session_id) <> 1 THEN RAISE EXCEPTION 'exactly one identity required'; END IF;
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_game.visibility <> 'PRIVATE' OR v_game.match_type <> 'CASUAL' THEN
    RAISE EXCEPTION 'private Casual game required';
  END IF;
  IF p_guest_session_id IS NOT NULL THEN
    SELECT nickname INTO v_name FROM public.guest_sessions WHERE id = p_guest_session_id AND expires_at > NOW();
    IF NOT FOUND THEN RAISE EXCEPTION 'guest session expired'; END IF;
    UPDATE public.guest_sessions SET last_active_at = NOW() WHERE id = p_guest_session_id;
  ELSE
    SELECT username INTO v_name FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'user missing'; END IF;
  END IF;
  SELECT id INTO v_id FROM public.game_players WHERE game_id = p_game_id
    AND (user_id = p_user_id OR guest_session_id = p_guest_session_id);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF v_game.status <> 'waiting' THEN RAISE EXCEPTION 'not a participant of this game'; END IF;
  INSERT INTO public.game_players(game_id, user_id, guest_session_id, player_name)
  VALUES(p_game_id, p_user_id, p_guest_session_id, v_name) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_casual_game(TEXT,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_casual_game(TEXT,UUID,UUID,TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.record_player_score_action_and_snapshot(
  p_game_id TEXT, p_game_player_id UUID, p_player_name TEXT, p_turn_number INTEGER,
  p_category TEXT, p_dice_values SMALLINT[], p_score INTEGER, p_total_after INTEGER,
  p_yams_face SMALLINT, p_state JSONB, p_expected_version INTEGER,
  p_turn_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_version INTEGER; v_player_id UUID;
BEGIN
  SELECT id INTO v_player_id FROM public.game_players WHERE id = p_game_player_id AND game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant does not belong to game'; END IF;
  INSERT INTO public.game_score_actions(
    game_id, game_player_id, user_id, player_name, turn_number, category,
    dice_values, score, total_after, yams_face
  ) VALUES (
    p_game_id, v_player_id, NULL, p_player_name, p_turn_number, p_category,
    p_dice_values, p_score, p_total_after, p_yams_face
  ) ON CONFLICT (game_player_id, category) DO NOTHING;
  SELECT public.save_game_snapshot(p_game_id, p_state, p_expected_version, p_turn_expires_at) INTO v_version;
  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_player_game_result(
  p_game_id TEXT, p_game_player_id UUID, p_player_name TEXT, p_score INTEGER,
  p_won BOOLEAN, p_abandoned BOOLEAN, p_yams_count INTEGER,
  p_yams_faces SMALLINT[], p_xp_gained INTEGER, p_score_sheet JSONB, p_reason TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted UUID; v_player_id UUID; v_user_id UUID;
BEGIN
  -- Serialize an early abandon with a simultaneous whole-game finalization.
  PERFORM 1 FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game % does not exist', p_game_id; END IF;
  SELECT id, user_id INTO v_player_id, v_user_id FROM public.game_players WHERE id = p_game_player_id AND game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant does not belong to game'; END IF;
  IF p_abandoned THEN
    UPDATE public.game_players SET abandoned = TRUE, left_at = COALESCE(left_at, NOW())
    WHERE id = v_player_id AND NOT abandoned;
  END IF;
  INSERT INTO public.game_results(
    game_id, game_player_id, user_id, player_name, score, won, abandoned,
    yams_count, yams_faces, xp_gained, score_sheet, reason
  ) VALUES (
    p_game_id, v_player_id, v_user_id, p_player_name, p_score, p_won, p_abandoned,
    p_yams_count, COALESCE(p_yams_faces, '{}'), CASE WHEN v_user_id IS NULL THEN 0 ELSE p_xp_gained END,
    COALESCE(p_score_sheet, '{}'), p_reason
  ) ON CONFLICT (game_player_id) DO NOTHING RETURNING game_player_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN FALSE; END IF;
  IF v_user_id IS NOT NULL THEN
  PERFORM public.update_user_stats(v_user_id, p_score, p_won, p_abandoned, p_yams_count, p_xp_gained);
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_game(p_game_id TEXT, p_results JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_result RECORD;
  v_player_id UUID;
  v_user_id UUID;
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
      game_player_id UUID, user_id UUID, player_name TEXT, score INTEGER, won BOOLEAN,
      abandoned BOOLEAN, yams_count INTEGER, yams_faces SMALLINT[],
      score_sheet JSONB, reason TEXT
    )
  LOOP
    IF (v_result.game_player_id IS NULL AND v_result.user_id IS NULL) OR v_result.player_name IS NULL OR v_result.score IS NULL
      OR v_result.won IS NULL OR v_result.abandoned IS NULL THEN
      RAISE EXCEPTION 'each result must include user_id, player_name, score, won and abandoned';
    END IF;
    IF v_result.score < 0 OR COALESCE(v_result.yams_count, 0) < 0 THEN
      RAISE EXCEPTION 'score and yams_count must be positive';
    END IF;
    IF v_result.won AND v_winner IS NULL THEN v_winner := v_result.player_name; END IF;

    v_player_id := v_result.game_player_id;
    IF v_player_id IS NULL THEN
      v_player_id := public.ensure_user_game_player(p_game_id, v_result.user_id, v_result.player_name);
    END IF;
    SELECT user_id INTO v_user_id FROM public.game_players WHERE id = v_player_id AND game_id = p_game_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'participant does not belong to game'; END IF;
    IF v_result.user_id IS NOT NULL AND v_result.user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'participant identity mismatch';
    END IF;
    UPDATE public.game_players SET
      abandoned = abandoned OR v_result.abandoned,
      left_at = CASE WHEN v_result.abandoned THEN COALESCE(left_at, NOW()) ELSE left_at END
    WHERE id = v_player_id AND (v_result.abandoned AND NOT abandoned);

    v_xp_gained := 0;
    IF v_user_id IS NOT NULL THEN
    SELECT serie_victoires_actuelle, COALESCE(xp, 0), COALESCE(level, 1)
      INTO v_current_streak, v_current_xp, v_current_level
      FROM public.users WHERE id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'user % does not exist', v_user_id; END IF;

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

    END IF;
    v_inserted_player_id := NULL;
    INSERT INTO public.game_results(
      game_id, game_player_id, user_id, player_name, score, won, abandoned,
      yams_count, yams_faces, xp_gained, score_sheet, reason
    ) VALUES (
      p_game_id, v_player_id, v_user_id, v_result.player_name, v_result.score,
      v_result.won, v_result.abandoned, COALESCE(v_result.yams_count, 0),
      COALESCE(v_result.yams_faces, '{}'), v_xp_gained,
      COALESCE(v_result.score_sheet, '{}'), COALESCE(v_result.reason, 'completed')
    ) ON CONFLICT (game_player_id) DO NOTHING
      RETURNING game_player_id INTO v_inserted_player_id;
    IF v_inserted_player_id IS NULL THEN CONTINUE; END IF;

    IF v_user_id IS NOT NULL THEN
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
    WHERE id = v_user_id;
    v_processed := array_append(v_processed, v_user_id);
    END IF;
  END LOOP;

  UPDATE public.games SET status = 'finished', winner = v_winner,
    players_scores = p_results, updated_at = NOW()
  WHERE id = p_game_id AND status IS DISTINCT FROM 'finished';
  v_first_completion := FOUND;
  RETURN jsonb_build_object('processed_user_ids', to_jsonb(v_processed),
    'first_completion', v_first_completion);
END;
$$;


REVOKE ALL ON FUNCTION public.record_player_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_player_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION public.record_player_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_player_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_game(TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_game(TEXT,JSONB) TO service_role;
COMMIT;
