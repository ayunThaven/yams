-- =====================================================
-- Yams - One-shot database initialization
-- =====================================================
-- Use this file on a fresh Supabase/Postgres database when you want to
-- initialize the current expected schema in one pass.
--
-- Do not run this together with the historical files in supabase/migrations.
-- Those files describe the incremental history; this file describes the
-- clean final state expected by the application.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =====================================================
-- Shared helpers
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Users and local auth
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',

  parties_jouees INTEGER NOT NULL DEFAULT 0 CHECK (parties_jouees >= 0),
  parties_gagnees INTEGER NOT NULL DEFAULT 0 CHECK (parties_gagnees >= 0),
  parties_abandonnees INTEGER NOT NULL DEFAULT 0 CHECK (parties_abandonnees >= 0),

  meilleur_score INTEGER NOT NULL DEFAULT 0 CHECK (meilleur_score >= 0),
  nombre_yams_realises INTEGER NOT NULL DEFAULT 0 CHECK (nombre_yams_realises >= 0),
  meilleure_serie_victoires INTEGER NOT NULL DEFAULT 0 CHECK (meilleure_serie_victoires >= 0),
  serie_victoires_actuelle INTEGER NOT NULL DEFAULT 0 CHECK (serie_victoires_actuelle >= 0),

  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 50),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_meilleur_score ON public.users(meilleur_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_parties_gagnees ON public.users(parties_gagnees DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_level ON public.users(level DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are readable" ON public.users;
CREATE POLICY "Public profiles are readable"
  ON public.users
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.auth_local_users (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_local_users_email ON public.auth_local_users(email);

ALTER TABLE public.auth_local_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.auth_local_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 days'),
  used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON public.email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
  ON public.email_verification_tokens(expires_at);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.auth_local_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
  used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON public.password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens(expires_at);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Games and idempotent player results
-- =====================================================

CREATE TABLE IF NOT EXISTS public.games (
  id TEXT PRIMARY KEY,
  host_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_progress', 'finished', 'server_interrupted')
  ),
  winner TEXT,
  players_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  variant TEXT NOT NULL DEFAULT 'classic' CHECK (
    variant IN ('classic', 'descending', 'ascending')
  ),
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_host_id ON public.games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_owner ON public.games(owner);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON public.games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_variant ON public.games(variant);
CREATE INDEX IF NOT EXISTS idx_games_players_scores ON public.games USING GIN(players_scores);

DROP TRIGGER IF EXISTS set_games_updated_at ON public.games;
CREATE TRIGGER set_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

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
  reason TEXT NOT NULL CHECK (
    reason IN ('completed', 'abandon', 'timeout', 'server_interrupted')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_player_results_user_id
  ON public.game_player_results(user_id);

CREATE INDEX IF NOT EXISTS idx_game_player_results_game_id
  ON public.game_player_results(game_id);

ALTER TABLE public.game_player_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Leveling and stats functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.xp_for_level(p_level INTEGER)
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

CREATE OR REPLACE FUNCTION public.level_from_xp(p_xp INTEGER)
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

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_xp := GREATEST(0, v_current_xp + COALESCE(p_xp_gained, 0));
  v_new_level := public.level_from_xp(v_new_xp);

  UPDATE public.users
  SET
    parties_jouees = parties_jouees + 1,
    parties_gagnees = CASE WHEN p_won THEN parties_gagnees + 1 ELSE parties_gagnees END,
    parties_abandonnees = CASE WHEN p_abandoned THEN parties_abandonnees + 1 ELSE parties_abandonnees END,
    meilleur_score = GREATEST(meilleur_score, GREATEST(0, COALESCE(p_score, 0))),
    nombre_yams_realises = nombre_yams_realises + GREATEST(0, COALESCE(p_yams_count, 0)),
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

-- =====================================================
-- Leaderboard
-- =====================================================

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  username,
  avatar_url,
  parties_jouees,
  parties_gagnees,
  parties_abandonnees,
  meilleur_score,
  nombre_yams_realises,
  meilleure_serie_victoires,
  serie_victoires_actuelle,
  xp,
  level,
  created_at,
  updated_at,
  CASE
    WHEN parties_jouees > 0
    THEN ROUND((parties_gagnees::DECIMAL / parties_jouees * 100), 2)
    ELSE 0
  END AS taux_victoire
FROM public.users
WHERE parties_jouees > 0
ORDER BY
  CASE
    WHEN parties_jouees > 0
    THEN ROUND((parties_gagnees::DECIMAL / parties_jouees * 100), 2)
    ELSE 0
  END DESC,
  parties_gagnees DESC,
  meilleur_score DESC;

-- =====================================================
-- Achievements
-- =====================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Bronze', 'Silver', 'Gold', 'Crystal')),
  category TEXT NOT NULL CHECK (
    category IN (
      'gameplay',
      'score',
      'victory',
      'streak',
      'level',
      'variant',
      'action',
      'classement',
      'special'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON public.achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON public.achievements(category);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements are readable" ON public.achievements;
CREATE POLICY "Achievements are readable"
  ON public.achievements
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON public.user_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id
  ON public.user_achievements(achievement_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at
  ON public.user_achievements(unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

INSERT INTO public.achievements (id, name, description, image_path, rarity, category)
VALUES
  ('create_game', 'Createur de partie', 'Creer une partie.', '/images/achievements/Bronze/Medals_CreateGame.webp', 'Bronze', 'action'),
  ('create_private_game', 'Partie privee', 'Creer une partie privee.', '/images/achievements/Bronze/Medals_CreatePrivateGame.webp', 'Bronze', 'action'),
  ('join_game', 'Invite', 'Rejoindre une partie.', '/images/achievements/Bronze/Medals_JoinGame.webp', 'Bronze', 'action'),
  ('give_up', 'Abandon', 'Abandonner une partie.', '/images/achievements/Bronze/Medals_GiveUp.webp', 'Bronze', 'action'),
  ('play_game', 'Premiere partie', 'Terminer une partie.', '/images/achievements/Bronze/Medals_PlayGame.webp', 'Bronze', 'gameplay'),
  ('loose_game', 'Premiere defaite', 'Perdre une partie sans abandonner.', '/images/achievements/Bronze/Medals_LoseGame.webp', 'Bronze', 'victory'),
  ('variant_descending', 'Descendante', 'Jouer une partie en variante descendante.', '/images/achievements/Bronze/Medals_Descendante.webp', 'Bronze', 'variant'),
  ('variant_ascending', 'Montante', 'Jouer une partie en variante montante.', '/images/achievements/Bronze/Medals_Montante.webp', 'Bronze', 'variant'),
  ('level_5', 'Niveau 5', 'Atteindre le niveau 5.', '/images/achievements/Bronze/Medals_Lv5.webp', 'Bronze', 'level'),
  ('level_10', 'Niveau 10', 'Atteindre le niveau 10.', '/images/achievements/Bronze/Medals_Lv10.webp', 'Bronze', 'level'),
  ('score_200', 'Score 200', 'Marquer au moins 200 points.', '/images/achievements/Silver/Medals_200Score.webp', 'Silver', 'score'),
  ('streak_3', 'Serie de 3', 'Gagner 3 parties de suite.', '/images/achievements/Silver/Medals_3Streak.webp', 'Silver', 'streak'),
  ('streak_5', 'Serie de 5', 'Gagner 5 parties de suite.', '/images/achievements/Silver/Medals_5Streak.webp', 'Silver', 'streak'),
  ('bonus', 'Bonus superieur', 'Obtenir le bonus de la section superieure.', '/images/achievements/Silver/Medals_Bonus.webp', 'Silver', 'score'),
  ('win_game', 'Premiere victoire', 'Gagner une partie.', '/images/achievements/Silver/Medals_WinGame.webp', 'Silver', 'victory'),
  ('level_20', 'Niveau 20', 'Atteindre le niveau 20.', '/images/achievements/Silver/Medals_Lv20.webp', 'Silver', 'level'),
  ('level_30', 'Niveau 30', 'Atteindre le niveau 30.', '/images/achievements/Silver/Medals_Lv30.webp', 'Silver', 'level'),
  ('score_250', 'Score 250', 'Marquer au moins 250 points.', '/images/achievements/Gold/Medals_250Score.webp', 'Gold', 'score'),
  ('streak_10', 'Serie de 10', 'Gagner 10 parties de suite.', '/images/achievements/Gold/Medals_10Streak.webp', 'Gold', 'streak'),
  ('level_40', 'Niveau 40', 'Atteindre le niveau 40.', '/images/achievements/Gold/Medals_Lv40.webp', 'Gold', 'level'),
  ('yams', 'Yams !', 'Realiser un Yams.', '/images/achievements/Gold/Medals_Yams.webp', 'Gold', 'gameplay'),
  ('yams_1', 'Yams de 1', 'Realiser un Yams de 1.', '/images/achievements/Gold/Medals_Yams1.webp', 'Gold', 'gameplay'),
  ('yams_2', 'Yams de 2', 'Realiser un Yams de 2.', '/images/achievements/Gold/Medals_Yams2.webp', 'Gold', 'gameplay'),
  ('yams_3', 'Yams de 3', 'Realiser un Yams de 3.', '/images/achievements/Gold/Medals_Yams3.webp', 'Gold', 'gameplay'),
  ('yams_4', 'Yams de 4', 'Realiser un Yams de 4.', '/images/achievements/Gold/Medals_Yams4.webp', 'Gold', 'gameplay'),
  ('yams_5', 'Yams de 5', 'Realiser un Yams de 5.', '/images/achievements/Gold/Medals_Yams5.webp', 'Gold', 'gameplay'),
  ('yams_6', 'Yams de 6', 'Realiser un Yams de 6.', '/images/achievements/Gold/Medals_Yams6.webp', 'Gold', 'gameplay'),
  ('score_300', 'Score 300', 'Marquer au moins 300 points.', '/images/achievements/Crystal/Medals_300Score_Text.webp', 'Crystal', 'score'),
  ('champion', 'Champion', 'Atteindre au moins 75% de victoires apres 10 parties.', '/images/achievements/Crystal/Medals_Champion_Text.webp', 'Crystal', 'victory'),
  ('level_50', 'Niveau 50', 'Atteindre le niveau 50.', '/images/achievements/Crystal/Medals_Lv50_Text.webp', 'Crystal', 'level'),
  ('perfect_game', 'Partie parfaite', 'Realiser une partie parfaite.', '/images/achievements/Crystal/SMedals_PerfectGame_Text.webp', 'Crystal', 'score'),
  ('level_33', 'Niveau 33', 'Atteindre le niveau 33.', '/images/achievements/Crystal/SMedals_Lv33_Text.webp', 'Crystal', 'level'),
  ('win_ayun', 'Defier Ayun', 'Gagner contre Ayun.', '/images/achievements/Crystal/SMedals_Ayun_Text.webp', 'Crystal', 'special'),
  ('bug_finder', 'Bug Finder', 'Signaler un bug confirme et corrige.', '/images/achievements/Crystal/SMedals_BugFinder_Text.webp', 'Crystal', 'special')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_path = EXCLUDED.image_path,
  rarity = EXCLUDED.rarity,
  category = EXCLUDED.category;

CREATE OR REPLACE VIEW public.achievements_with_rarity_rank AS
SELECT
  a.*,
  CASE a.rarity
    WHEN 'Crystal' THEN 1
    WHEN 'Gold' THEN 2
    WHEN 'Silver' THEN 3
    ELSE 4
  END AS rarity_rank
FROM public.achievements a;

CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.achievements WHERE id = p_achievement_id
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING
  RETURNING id INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- Grants
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT SELECT ON public.achievements_with_rarity_rank TO anon, authenticated;

-- The backend connects with service_role. It bypasses RLS, but PostgreSQL
-- object privileges remain mandatory for all application tables and views.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Local authentication is performed only by the server-side service_role
-- client. A service-role JWT bypasses RLS, but table privileges are still
-- required.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_local_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verification_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_tokens TO service_role;

GRANT EXECUTE ON FUNCTION public.xp_for_level(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.level_from_xp(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_stats(UUID, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_game_player_result(TEXT, UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(UUID, TEXT) TO service_role;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE public.users IS 'Application user profiles and game stats.';
COMMENT ON TABLE public.auth_local_users IS 'Local email/password auth users. Same id as public.users.';
COMMENT ON TABLE public.games IS 'Yams games.';
COMMENT ON TABLE public.game_player_results IS 'Idempotent per-player game results. Unique by game_id and user_id.';
COMMENT ON TABLE public.achievements IS 'Achievement catalog.';
COMMENT ON TABLE public.user_achievements IS 'Achievements unlocked by users.';

COMMENT ON COLUMN public.games.id IS 'Short game code.';
COMMENT ON COLUMN public.games.owner IS 'Local user id of the game creator.';
COMMENT ON COLUMN public.games.players_scores IS 'Final player scores as JSON.';
COMMENT ON COLUMN public.games.variant IS 'Game variant: classic, descending, ascending.';
COMMENT ON COLUMN public.games.max_players IS 'Maximum number of players allowed in the game, from 2 to 8.';
