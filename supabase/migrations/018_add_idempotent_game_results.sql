-- =====================================================
-- Migration : Résultats de partie idempotents + leveling synchronisé
-- =====================================================

CREATE TABLE IF NOT EXISTS public.game_player_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  won BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  yams_count INTEGER NOT NULL DEFAULT 0 CHECK (yams_count >= 0),
  xp_gained INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('completed', 'abandon', 'timeout', 'server_interrupted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_player_results_user_id
  ON public.game_player_results(user_id);

CREATE INDEX IF NOT EXISTS idx_game_player_results_game_id
  ON public.game_player_results(game_id);

CREATE OR REPLACE FUNCTION public.xp_for_level(
  p_level INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_base INTEGER := 10;
  v_growth DECIMAL := 1.07;
BEGIN
  IF p_level <= 0 THEN
    RETURN 0;
  END IF;

  RETURN FLOOR(v_base * ((POWER(v_growth, p_level + 1) - 1) / (v_growth - 1)))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.level_from_xp(
  p_xp INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_xp_for_next_level INTEGER;
BEGIN
  IF p_xp <= 0 THEN
    RETURN 1;
  END IF;

  LOOP
    v_xp_for_next_level := public.xp_for_level(v_level + 1);

    IF v_xp_for_next_level > p_xp THEN
      RETURN LEAST(v_level, 50);
    END IF;

    v_level := v_level + 1;

    IF v_level > 50 THEN
      RETURN 50;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.update_user_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_won BOOLEAN,
  p_abandoned BOOLEAN DEFAULT FALSE,
  p_yams_count INTEGER DEFAULT 0,
  p_xp_gained INTEGER DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_current_serie INTEGER;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  SELECT
    COALESCE(serie_victoires_actuelle, 0),
    COALESCE(xp, 0)
  INTO
    v_current_serie,
    v_current_xp
  FROM public.users
  WHERE id = p_user_id;

  v_new_xp := GREATEST(0, v_current_xp + p_xp_gained);
  v_new_level := public.level_from_xp(v_new_xp);

  UPDATE public.users
  SET
    parties_jouees = parties_jouees + 1,
    parties_gagnees = CASE WHEN p_won THEN parties_gagnees + 1 ELSE parties_gagnees END,
    parties_abandonnees = CASE WHEN p_abandoned THEN parties_abandonnees + 1 ELSE parties_abandonnees END,
    meilleur_score = GREATEST(meilleur_score, p_score),
    nombre_yams_realises = nombre_yams_realises + p_yams_count,
    serie_victoires_actuelle = CASE
      WHEN p_won THEN v_current_serie + 1
      WHEN p_abandoned THEN v_current_serie
      ELSE 0
    END,
    meilleure_serie_victoires = GREATEST(
      meilleure_serie_victoires,
      CASE WHEN p_won THEN v_current_serie + 1 ELSE v_current_serie END
    ),
    xp = v_new_xp,
    level = v_new_level,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_game_player_result(
  p_game_id TEXT,
  p_user_id UUID,
  p_player_name TEXT,
  p_score INTEGER,
  p_won BOOLEAN,
  p_abandoned BOOLEAN DEFAULT FALSE,
  p_yams_count INTEGER DEFAULT 0,
  p_xp_gained INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT 'completed'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted UUID;
BEGIN
  INSERT INTO public.game_player_results (
    game_id,
    user_id,
    player_name,
    score,
    won,
    abandoned,
    yams_count,
    xp_gained,
    reason
  )
  VALUES (
    p_game_id,
    p_user_id,
    p_player_name,
    p_score,
    p_won,
    p_abandoned,
    p_yams_count,
    p_xp_gained,
    p_reason
  )
  ON CONFLICT (game_id, user_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM public.update_user_stats(
    p_user_id,
    p_score,
    p_won,
    p_abandoned,
    p_yams_count,
    p_xp_gained
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT ON public.game_player_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_player_result(
  TEXT,
  UUID,
  TEXT,
  INTEGER,
  BOOLEAN,
  BOOLEAN,
  INTEGER,
  INTEGER,
  TEXT
) TO service_role;

-- =====================================================
-- Fin de la migration
-- =====================================================
