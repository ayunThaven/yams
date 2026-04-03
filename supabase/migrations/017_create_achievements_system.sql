-- =====================================================
-- Migration : Système d'achievements
-- =====================================================

-- 1. Table des achievements disponibles
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Bronze', 'Silver', 'Gold', 'Crystal')),
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table de liaison user-achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- 3. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON public.user_achievements(unlocked_at DESC);

-- 4. RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Policy : Tout le monde peut voir les achievements
CREATE POLICY "Les achievements sont visibles par tous"
  ON public.achievements FOR SELECT
  USING (true);

-- Policy : Les utilisateurs peuvent voir leurs propres achievements
CREATE POLICY "Les utilisateurs peuvent voir leurs achievements"
  ON public.user_achievements FOR SELECT
  USING (true);

-- Policy : Seul le système peut insérer des achievements (via fonction)
CREATE POLICY "Insertion via fonction uniquement"
  ON public.user_achievements FOR INSERT
  WITH CHECK (false);

-- 5. Fonction pour débloquer un achievement
CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier si l'achievement existe
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE id = p_achievement_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Vérifier si l'achievement n'est pas déjà débloqué
  IF EXISTS (SELECT 1 FROM public.user_achievements 
             WHERE user_id = p_user_id AND achievement_id = p_achievement_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Débloquer l'achievement
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id);
  
  RETURN TRUE;
END;
$$;

-- 6. Insérer les achievements de base
INSERT INTO public.achievements (id, name, description, image_path, rarity, category) VALUES
-- Yams
('yams', 'Premier Yams', 'Réalisez votre premier Yams', '/images/achievements/Gold/Medals_Yams.webp', 'Gold', 'gameplay'),
('yams_1', 'Yams de 1', 'Réalisez un Yams de 1', '/images/achievements/Gold/Medals_Yams1.webp', 'Gold', 'gameplay'),
('yams_2', 'Yams de 2', 'Réalisez un Yams de 2', '/images/achievements/Gold/Medals_Yams2.webp', 'Gold', 'gameplay'),
('yams_3', 'Yams de 3', 'Réalisez un Yams de 3', '/images/achievements/Gold/Medals_Yams3.webp', 'Gold', 'gameplay'),
('yams_4', 'Yams de 4', 'Réalisez un Yams de 4', '/images/achievements/Gold/Medals_Yams4.webp', 'Gold', 'gameplay'),
('yams_5', 'Yams de 5', 'Réalisez un Yams de 5', '/images/achievements/Gold/Medals_Yams5.webp', 'Gold', 'gameplay'),
('yams_6', 'Yams de 6', 'Réalisez un Yams de 6', '/images/achievements/Gold/Medals_Yams6.webp', 'Gold', 'gameplay'),

-- Scores
('score_200', 'Score 200', 'Atteignez un score de 200 points', '/images/achievements/Silver/Medals_200Score.webp', 'Silver', 'score'),
('score_250', 'Score 250', 'Atteignez un score de 250 points', '/images/achievements/Gold/Medals_250Score.webp', 'Gold', 'score'),
('score_300', 'Score 300', 'Atteignez un score de 300 points', '/images/achievements/Crystal/Medals_300Score_Text.webp', 'Crystal', 'score'),

-- Victoires
('win_game', 'Première victoire', 'Gagnez votre première partie', '/images/achievements/Silver/Medals_WinGame.webp', 'Silver', 'victory'),
('win_all_in_one', 'Victoire All-in-One', 'Gagnez une partie "All-in-One"', '/images/achievements/Silver/Medals_WinAllInOne.webp', 'Silver', 'victory'),
('streak_3', 'Série de 3', 'Gagnez 3 parties consécutives', '/images/achievements/Silver/Medals_3Streak.webp', 'Silver', 'streak'),
('streak_5', 'Série de 5', 'Gagnez 5 parties consécutives', '/images/achievements/Silver/Medals_5Streak.webp', 'Silver', 'streak'),
('streak_10', 'Série de 10', 'Gagnez 10 parties consécutives', '/images/achievements/Gold/Medals_10Streak.webp', 'Gold', 'streak'),
('loose_game', 'Première défaite', 'Perdez votre première partie', '/images/achievements/Silver/Medals_LooseGame.webp', 'Silver', 'victory'),

-- Niveaux
('level_5', 'Niveau 5', 'Atteignez le niveau 5', '/images/achievements/Bronze/Medals_Lv5.webp', 'Bronze', 'level'),
('level_10', 'Niveau 10', 'Atteignez le niveau 10', '/images/achievements/Bronze/Medals_Lv10.webp', 'Bronze', 'level'),
('level_20', 'Niveau 20', 'Atteignez le niveau 20', '/images/achievements/Silver/Medals_Lv20.webp', 'Silver', 'level'),
('level_30', 'Niveau 30', 'Atteignez le niveau 30', '/images/achievements/Silver/Medals_Lv30.webp', 'Silver', 'level'),
('level_40', 'Niveau 40', 'Atteignez le niveau 40', '/images/achievements/Gold/Medals_Lv40.webp', 'Gold', 'level'),
('level_50', 'Niveau 50', 'Atteignez le niveau 50', '/images/achievements/Crystal/Medals_Lv50_Text.webp', 'Crystal', 'level'),

-- Bonus
('bonus', 'Prime obtenu', 'Obtenez le bonus de prime de 35 points', '/images/achievements/Silver/Medals_Bonus.webp', 'Silver', 'gameplay'),

-- Variantes
('variant_descending', 'Variante descendante', 'Jouez une partie en mode descendante', '/images/achievements/Bronze/Medals_Descendante.webp', 'Bronze', 'variant'),
('variant_ascending', 'Variante montante', 'Jouez une partie en mode montante', '/images/achievements/Bronze/Medals_Montante.webp', 'Bronze', 'variant'),
('all_in_one', 'All-in-One', 'Faire une partie "All-in-One"', '/images/achievements/Bronze/Medals_AllInOne.webp', 'Bronze', 'variant'),
('win_all_in_one', 'All-in-One', 'Gagnez une partie "All-in-One"', '/images/achievements/Silver/Medals_WinAllInOne.webp', 'Silver', 'variant'),
-- Actions
('play_game', 'Première partie', 'Jouez votre première partie', '/images/achievements/Bronze/Medals_PlayGame.webp', 'Bronze', 'action'),
('create_game', 'Créer une partie', 'Créez votre première partie', '/images/achievements/Bronze/Medals_CreateGame.webp', 'Bronze', 'action'),
('create_private_game', 'Partie privée' , 'Créer une partie privée (amis seulement)', '/images/achievements/Bronze/Medals_CreatePrivateGame.webp', 'Bronze', 'action'),
('join_game', 'Rejoindre une partie', 'Rejoignez une partie', '/images/achievements/Bronze/Medals_JoinGame.webp', 'Bronze', 'action')
('give_up', 'Abandonner', 'Abandonner une partie', '/images/achievements/Bronze/Medals_GiveUp.webp', 'Bronze', 'action'),
('friend_1', 'Premier ami', 'Ajoutez votre premier ami', '/images/achievements/Bronze/Medals_Friend1.webp', 'Bronze', 'action'),

-- Classement
('top_1', 'Top 1', 'Atteignez le top 1 du leaderboard', '/images/achievements/Crystal/Medals_Top1_Text.webp', 'Crystal', 'classement'),
('top_2', 'Top 2', 'Atteignez le top 2 du leaderboard', '/images/achievements/Gold/Medals_Top2.webp', 'Gold', 'classement'),
('top_3', 'Top 3', 'Atteignez le top 3 du leaderboard', '/images/achievements/Silver/Medals_Top3.webp', 'Silver', 'classement'),
('top_5', 'Top 5', 'Atteignez le top 5 du leaderboard', '/images/achievements/Bronze/Medals_Top5.webp', 'Crystal', 'classement'),


-- Spécials
('champion', 'Champion', 'Obtenez un taux de victoire de 75% avec au moins 10 parties jouées', '/images/achievements/Crystal/Medals_Champion_Text.webp', 'Crystal', 'special'),
('perfect_game', 'Partie parfaite', 'Gagnez une partie en réalisant le score maximum de 375 points', '/images/achievements/Crystal/Medals_PerfectGame_Text.webp', 'Crystal', 'special'),
('yatzhee', 'Yatzhee', 'Gagnez une partie en réalisant un Yatzhee', '/images/achievements/Crystal/Medals_Yatzhee_Text.webp', 'Crystal', 'special'),
('bug_finder', 'Bug finder', 'Trouvez un bug', '/images/achievements/Crystal/Medals_BugFinder_Text.webp', 'Crystal', 'special'),
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Fin de la migration
-- =====================================================

