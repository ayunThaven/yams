-- =====================================================
-- Schéma initial condensé — état final de la base
-- Remplace les migrations 001 à 024
-- =====================================================


-- =====================================================
-- 0. Nettoyage complet du schéma public
-- =====================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres;


-- =====================================================
-- 1. Fonctions
-- =====================================================

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- XP cumulé nécessaire pour atteindre un level donné
-- Formule : floor(base * ((growth^(level+1) - 1) / (growth - 1)))  base=10, growth=1.05
CREATE OR REPLACE FUNCTION public.xp_for_level(p_level INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_base   INTEGER := 10;
  v_growth DECIMAL := 1.05;
BEGIN
  IF p_level <= 0 THEN RETURN 0; END IF;
  RETURN FLOOR(v_base * ((POWER(v_growth, p_level + 1) - 1) / (v_growth - 1)))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Level courant déduit de l'XP total, plafonné à 50
CREATE OR REPLACE FUNCTION public.level_from_xp(p_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_level             INTEGER := 1;
  v_xp_for_next_level INTEGER;
BEGIN
  IF p_xp <= 0 THEN RETURN 1; END IF;
  LOOP
    v_xp_for_next_level := public.xp_for_level(v_level + 1);
    IF v_xp_for_next_level > p_xp THEN RETURN LEAST(v_level, 50); END IF;
    v_level := v_level + 1;
    IF v_level > 50 THEN RETURN 50; END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mise à jour des stats d'un joueur après une partie
-- XP plafonné à xp_for_level(50), niveau plafonné à 50, XP jamais négatif
CREATE OR REPLACE FUNCTION public.update_user_stats(
  p_user_id    UUID,
  p_score      INTEGER,
  p_won        BOOLEAN,
  p_abandoned  BOOLEAN DEFAULT FALSE,
  p_yams_count INTEGER DEFAULT 0,
  p_xp_gained  INTEGER DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_current_serie INTEGER;
  v_current_xp    INTEGER;
  v_current_level INTEGER;
  v_new_xp        INTEGER;
  v_new_level     INTEGER;
BEGIN
  SELECT serie_victoires_actuelle, COALESCE(xp, 0), COALESCE(level, 1)
  INTO   v_current_serie, v_current_xp, v_current_level
  FROM   public.users
  WHERE  id = p_user_id;

  IF v_current_level >= 50 THEN
    v_new_xp    := v_current_xp;
    v_new_level := 50;
  ELSE
    v_new_xp    := GREATEST(0, v_current_xp + p_xp_gained);
    v_new_level := public.level_from_xp(v_new_xp);
    IF v_new_level > 50 THEN
      v_new_level := 50;
      v_new_xp    := LEAST(v_new_xp, public.xp_for_level(50));
    END IF;
  END IF;

  UPDATE public.users SET
    parties_jouees            = parties_jouees + 1,
    parties_gagnees           = CASE WHEN p_won       THEN parties_gagnees + 1     ELSE parties_gagnees     END,
    parties_abandonnees       = CASE WHEN p_abandoned THEN parties_abandonnees + 1 ELSE parties_abandonnees END,
    meilleur_score            = GREATEST(meilleur_score, p_score),
    nombre_yams_realises      = nombre_yams_realises + p_yams_count,
    serie_victoires_actuelle  = CASE
                                  WHEN p_won       THEN v_current_serie + 1
                                  WHEN p_abandoned THEN v_current_serie
                                  ELSE 0
                                END,
    meilleure_serie_victoires = GREATEST(
                                  meilleure_serie_victoires,
                                  CASE WHEN p_won THEN v_current_serie + 1 ELSE v_current_serie END
                                ),
    xp         = v_new_xp,
    level      = v_new_level,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Débloquer un achievement pour un joueur (retourne FALSE si déjà débloqué ou inexistant)
CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id        UUID,
  p_achievement_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE id = p_achievement_id) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_achievements
             WHERE user_id = p_user_id AND achievement_id = p_achievement_id) THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, p_achievement_id);
  RETURN TRUE;
END;
$$;


-- =====================================================
-- 2. Tables
-- =====================================================

-- Profils utilisateurs + stats de jeu
CREATE TABLE public.users (
  id                        UUID        PRIMARY KEY,
  username                  TEXT        UNIQUE NOT NULL,
  avatar_url                TEXT        DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  parties_jouees            INTEGER     DEFAULT 0 CHECK (parties_jouees            >= 0),
  parties_gagnees           INTEGER     DEFAULT 0 CHECK (parties_gagnees           >= 0),
  parties_abandonnees       INTEGER     DEFAULT 0 CHECK (parties_abandonnees       >= 0),
  meilleur_score            INTEGER     DEFAULT 0 CHECK (meilleur_score            >= 0),
  nombre_yams_realises      INTEGER     DEFAULT 0 CHECK (nombre_yams_realises      >= 0),
  meilleure_serie_victoires INTEGER     DEFAULT 0 CHECK (meilleure_serie_victoires >= 0),
  serie_victoires_actuelle  INTEGER     DEFAULT 0 CHECK (serie_victoires_actuelle  >= 0),
  xp                        INTEGER     DEFAULT 0 CHECK (xp                        >= 0),
  level                     INTEGER     DEFAULT 1 CHECK (level >= 1 AND level <= 50),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Authentification locale (indépendante de Supabase Auth)
-- L'id est le même que dans public.users
CREATE TABLE public.auth_local_users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid() REFERENCES public.users(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  email_verified BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tokens de vérification d'email
CREATE TABLE public.email_verification_tokens (
  token      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.auth_local_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 days'),
  used       BOOLEAN     NOT NULL DEFAULT false
);

-- Tokens de réinitialisation de mot de passe
CREATE TABLE public.password_reset_tokens (
  token      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.auth_local_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 day'),
  used       BOOLEAN     NOT NULL DEFAULT false
);

-- Catalogue des achievements disponibles
CREATE TABLE public.achievements (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  image_path  TEXT        NOT NULL,
  rarity      TEXT        NOT NULL CHECK (rarity IN ('Bronze', 'Silver', 'Gold', 'Crystal')),
  category    TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements débloqués par joueur
CREATE TABLE public.user_achievements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

-- Parties de Yams
-- RLS désactivé : toutes les écritures passent par le service_role côté backend
CREATE TABLE public.games (
  id             TEXT        PRIMARY KEY,
  host_id        UUID,
  owner          UUID,
  status         TEXT        DEFAULT 'waiting'
                   CHECK (status IN ('waiting', 'in_progress', 'finished', 'server_interrupted')),
  winner         TEXT,
  players_scores JSONB       DEFAULT '[]'::jsonb,
  variant        TEXT        DEFAULT 'classic'
                   CHECK (variant IN ('classic', 'descending', 'ascending')),
  max_players    INTEGER     DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 8),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 3. Index
-- =====================================================

CREATE INDEX idx_users_username          ON public.users(username);
CREATE INDEX idx_users_meilleur_score    ON public.users(meilleur_score DESC);
CREATE INDEX idx_users_parties_gagnees   ON public.users(parties_gagnees DESC);
CREATE INDEX idx_users_created_at        ON public.users(created_at DESC);

CREATE INDEX idx_games_status            ON public.games(status);
CREATE INDEX idx_games_host_id           ON public.games(host_id);
CREATE INDEX idx_games_owner             ON public.games(owner);
CREATE INDEX idx_games_created_at        ON public.games(created_at DESC);
CREATE INDEX idx_games_variant           ON public.games(variant);
CREATE INDEX idx_games_players_scores    ON public.games USING gin(players_scores);

CREATE INDEX idx_user_achievements_user_id        ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON public.user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_unlocked_at    ON public.user_achievements(unlocked_at DESC);


-- =====================================================
-- 4. Triggers
-- =====================================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =====================================================
-- 5. Vues
-- =====================================================

-- Leaderboard : tous les joueurs ayant au moins une partie
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
WHERE parties_jouees > 0;

-- Achievements actifs triés par rang de rareté
CREATE OR REPLACE VIEW public.achievements_with_rarity_rank AS
SELECT
  a.*,
  CASE LOWER(a.rarity)
    WHEN 'bronze'  THEN 0
    WHEN 'silver'  THEN 1
    WHEN 'gold'    THEN 2
    WHEN 'crystal' THEN 3
    ELSE 99
  END AS rarity_rank
FROM public.achievements a
WHERE a.is_active IS TRUE;


-- =====================================================
-- 6. Row Level Security
-- =====================================================

-- users : lecture publique, modification et création réservées au propriétaire
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les profils publics sont visibles par tous"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
  ON public.users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Seul le système peut créer des profils"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- games : RLS désactivé, sécurité gérée côté backend (service_role)
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;

-- achievements : lecture publique
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les achievements sont visibles par tous"
  ON public.achievements FOR SELECT USING (true);

-- user_achievements : lecture publique, insertion via fonction uniquement
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs peuvent voir leurs achievements"
  ON public.user_achievements FOR SELECT USING (true);

CREATE POLICY "Insertion via fonction uniquement"
  ON public.user_achievements FOR INSERT WITH CHECK (false);


-- =====================================================
-- 7. Permissions
-- =====================================================

GRANT SELECT ON public.leaderboard                    TO authenticated;
GRANT SELECT ON public.leaderboard                    TO anon;
GRANT SELECT ON public.achievements_with_rarity_rank  TO authenticated;
GRANT SELECT ON public.achievements_with_rarity_rank  TO anon;


-- =====================================================
-- 8. Commentaires — tables existantes
-- =====================================================

COMMENT ON TABLE  public.users                           IS 'Profils utilisateurs avec statistiques de jeu';
COMMENT ON COLUMN public.users.id                        IS 'UUID du joueur (même que auth_local_users.id)';
COMMENT ON COLUMN public.users.username                  IS 'Nom d''utilisateur unique visible par tous';
COMMENT ON COLUMN public.users.avatar_url                IS 'URL de l''avatar (Dicebear par défaut)';
COMMENT ON COLUMN public.users.parties_jouees            IS 'Nombre total de parties complétées';
COMMENT ON COLUMN public.users.parties_gagnees           IS 'Nombre de victoires';
COMMENT ON COLUMN public.users.meilleur_score            IS 'Score le plus élevé obtenu';
COMMENT ON COLUMN public.users.nombre_yams_realises      IS 'Nombre de fois où le joueur a réalisé un Yams';
COMMENT ON COLUMN public.users.meilleure_serie_victoires IS 'Plus longue série de victoires consécutives';
COMMENT ON COLUMN public.users.serie_victoires_actuelle  IS 'Série de victoires en cours';
COMMENT ON COLUMN public.users.xp                        IS 'Points d''expérience totaux accumulés';
COMMENT ON COLUMN public.users.level                     IS 'Niveau actuel calculé à partir de l''XP';

COMMENT ON TABLE  public.auth_local_users                IS 'Authentification locale — email + mot de passe hashé';
COMMENT ON COLUMN public.auth_local_users.id             IS 'Même UUID que public.users.id';

-- =====================================================
-- 9. Données initiales — achievements
-- =====================================================

INSERT INTO public.achievements (id, name, description, image_path, rarity, category) VALUES
-- Yams
('yams',   'Premier Yams', 'Réalisez votre premier Yams',  '/images/achievements/Gold/Medals_Yams.webp',  'Gold', 'gameplay'),
('yams_1', 'Yams de 1',    'Réalisez un Yams de 1',        '/images/achievements/Gold/Medals_Yams1.webp', 'Gold', 'gameplay'),
('yams_2', 'Yams de 2',    'Réalisez un Yams de 2',        '/images/achievements/Gold/Medals_Yams2.webp', 'Gold', 'gameplay'),
('yams_3', 'Yams de 3',    'Réalisez un Yams de 3',        '/images/achievements/Gold/Medals_Yams3.webp', 'Gold', 'gameplay'),
('yams_4', 'Yams de 4',    'Réalisez un Yams de 4',        '/images/achievements/Gold/Medals_Yams4.webp', 'Gold', 'gameplay'),
('yams_5', 'Yams de 5',    'Réalisez un Yams de 5',        '/images/achievements/Gold/Medals_Yams5.webp', 'Gold', 'gameplay'),
('yams_6', 'Yams de 6',    'Réalisez un Yams de 6',        '/images/achievements/Gold/Medals_Yams6.webp', 'Gold', 'gameplay'),
-- Scores
('score_200', 'Score 200', 'Atteignez un score de 200 points', '/images/achievements/Silver/Medals_200Score.webp',        'Silver',  'score'),
('score_250', 'Score 250', 'Atteignez un score de 250 points', '/images/achievements/Gold/Medals_250Score.webp',          'Gold',    'score'),
('score_300', 'Score 300', 'Atteignez un score de 300 points', '/images/achievements/Crystal/Medals_300Score_Text.webp',  'Crystal', 'score'),
-- Victoires
('win_game',      'Première victoire',    'Gagnez votre première partie',         '/images/achievements/Silver/Medals_WinGame.webp',      'Silver', 'victory'),
('loose_game',    'Première défaite',     'Perdez votre première partie',         '/images/achievements/Silver/Medals_LooseGame.webp',     'Silver', 'victory'),
('streak_3',      'Série de 3',           'Gagnez 3 parties consécutives',        '/images/achievements/Silver/Medals_3Streak.webp',       'Silver', 'streak'),
('streak_5',      'Série de 5',           'Gagnez 5 parties consécutives',        '/images/achievements/Silver/Medals_5Streak.webp',       'Silver', 'streak'),
('streak_10',     'Série de 10',          'Gagnez 10 parties consécutives',       '/images/achievements/Gold/Medals_10Streak.webp',        'Gold',   'streak'),
-- Niveaux
('level_5',  'Niveau 5',  'Atteignez le niveau 5',  '/images/achievements/Bronze/Medals_Lv5.webp',          'Bronze',  'level'),
('level_10', 'Niveau 10', 'Atteignez le niveau 10', '/images/achievements/Bronze/Medals_Lv10.webp',         'Bronze',  'level'),
('level_20', 'Niveau 20', 'Atteignez le niveau 20', '/images/achievements/Silver/Medals_Lv20.webp',         'Silver',  'level'),
('level_30', 'Niveau 30', 'Atteignez le niveau 30', '/images/achievements/Silver/Medals_Lv30.webp',         'Silver',  'level'),
('level_40', 'Niveau 40', 'Atteignez le niveau 40', '/images/achievements/Gold/Medals_Lv40.webp',           'Gold',    'level'),
('level_50', 'Niveau 50', 'Atteignez le niveau 50', '/images/achievements/Crystal/Medals_Lv50_Text.webp',   'Crystal', 'level'),
-- Gameplay
('bonus', 'Prime obtenu', 'Obtenez le bonus de prime de 35 points', '/images/achievements/Silver/Medals_Bonus.webp', 'Silver', 'gameplay'),
-- Variantes
('variant_descending', 'Variante descendante', 'Jouez une partie en mode descendante',  '/images/achievements/Bronze/Medals_Descendante.webp',   'Bronze', 'variant'),
('variant_ascending',  'Variante montante',    'Jouez une partie en mode montante',      '/images/achievements/Bronze/Medals_Montante.webp',       'Bronze', 'variant'),
('all_in_one',         'All-in-One',           'Faire une partie "All-in-One"',          '/images/achievements/Bronze/Medals_AllInOne.webp',       'Bronze', 'variant'),
('win_all_in_one',     'Victoire All-in-One',  'Gagnez une partie "All-in-One"',         '/images/achievements/Silver/Medals_WinAllInOne.webp',    'Silver', 'variant'),
-- Actions
('play_game',          'Première partie',      'Jouez votre première partie',             '/images/achievements/Bronze/Medals_PlayGame.webp',         'Bronze', 'action'),
('create_game',        'Créer une partie',     'Créez votre première partie',             '/images/achievements/Bronze/Medals_CreateGame.webp',       'Bronze', 'action'),
('create_private_game','Partie privée',        'Créer une partie privée (amis seulement)','/images/achievements/Bronze/Medals_CreatePrivateGame.webp', 'Bronze', 'action'),
('join_game',          'Rejoindre une partie', 'Rejoignez une partie',                    '/images/achievements/Bronze/Medals_JoinGame.webp',         'Bronze', 'action'),
('give_up',            'Abandonner',           'Abandonner une partie',                   '/images/achievements/Bronze/Medals_GiveUp.webp',           'Bronze', 'action'),
('friend_1',           'Premier ami',          'Ajoutez votre premier ami',               '/images/achievements/Bronze/Medals_Friend1.webp',          'Bronze', 'action'),
-- Classement
('top_1', 'Top 1', 'Atteignez le top 1 du leaderboard', '/images/achievements/Crystal/Medals_Top1_Text.webp', 'Crystal', 'classement'),
('top_2', 'Top 2', 'Atteignez le top 2 du leaderboard', '/images/achievements/Gold/Medals_Top2.webp',         'Gold',    'classement'),
('top_3', 'Top 3', 'Atteignez le top 3 du leaderboard', '/images/achievements/Silver/Medals_Top3.webp',       'Silver',  'classement'),
('top_5', 'Top 5', 'Atteignez le top 5 du leaderboard', '/images/achievements/Bronze/Medals_Top5.webp',       'Crystal', 'classement'),
-- Spéciaux
('champion',    'Champion',       'Obtenez un taux de victoire de 75% avec au moins 10 parties jouées',  '/images/achievements/Crystal/Medals_Champion_Text.webp',    'Crystal', 'special'),
('perfect_game','Partie parfaite','Gagnez une partie en réalisant le score maximum de 375 points',       '/images/achievements/Crystal/Medals_PerfectGame_Text.webp',  'Crystal', 'special'),
('yatzhee',     'Yatzhee',        'Gagnez une partie en réalisant un Yatzhee',                           '/images/achievements/Crystal/Medals_Yatzhee_Text.webp',      'Crystal', 'special'),
('bug_finder',  'Bug finder',     'Trouvez un bug',                                                      '/images/achievements/Crystal/Medals_BugFinder_Text.webp',    'Crystal', 'special')
ON CONFLICT (id) DO NOTHING;

-- Ces succès correspondent à des fonctionnalités qui ne sont pas disponibles.
-- Ils restent dans le catalogue pour une éventuelle réactivation future.
UPDATE public.achievements
SET is_active = FALSE
WHERE id IN ('all_in_one', 'win_all_in_one', 'friend_1');


-- =====================================================
-- 10. Commentaires
-- =====================================================

COMMENT ON TABLE  public.games                           IS 'Parties de Yams';
COMMENT ON COLUMN public.games.id                        IS 'Identifiant court de la partie';
COMMENT ON COLUMN public.games.host_id                   IS 'UUID de l''hôte';
COMMENT ON COLUMN public.games.owner                     IS 'UUID du créateur de la partie';
COMMENT ON COLUMN public.games.status                    IS 'Statut : waiting | in_progress | finished | server_interrupted';
COMMENT ON COLUMN public.games.winner                    IS 'UUID du gagnant';
COMMENT ON COLUMN public.games.players_scores            IS 'Scores JSON : [{"id","name","score","abandoned"}]';
COMMENT ON COLUMN public.games.variant                   IS 'Variante : classic | descending | ascending';
COMMENT ON COLUMN public.games.max_players               IS 'Nombre maximum de joueurs (2–8)';

COMMENT ON TABLE  public.achievements                    IS 'Catalogue des achievements disponibles';
COMMENT ON COLUMN public.achievements.is_active          IS 'FALSE pour masquer un achievement sans le supprimer';

COMMENT ON TABLE  public.user_achievements               IS 'Achievements débloqués par joueur';
COMMENT ON COLUMN public.user_achievements.unlocked_at   IS 'Date à laquelle l''achievement a été débloqué';
