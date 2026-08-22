-- =====================================================
-- Migration : Schéma reproductible des achievements
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

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON public.user_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at
  ON public.user_achievements(unlocked_at DESC);

INSERT INTO public.achievements (id, name, description, image_path, rarity, category)
VALUES
  ('create_game', 'Créateur de partie', 'Créer une partie.', '/images/achievements/Bronze/Medals_CreateGame.webp', 'Bronze', 'action'),
  ('create_private_game', 'Partie privée', 'Créer une partie privée.', '/images/achievements/Bronze/Medals_CreatePrivateGame.webp', 'Bronze', 'action'),
  ('join_game', 'Invité', 'Rejoindre une partie.', '/images/achievements/Bronze/Medals_JoinGame.webp', 'Bronze', 'action'),
  ('give_up', 'Abandon', 'Abandonner une partie.', '/images/achievements/Bronze/Medals_GiveUp.webp', 'Bronze', 'action'),
  ('play_game', 'Première partie', 'Terminer une partie.', '/images/achievements/Bronze/Medals_PlayGame.webp', 'Bronze', 'gameplay'),
  ('loose_game', 'Première défaite', 'Perdre une partie sans abandonner.', '/images/achievements/Bronze/Medals_LoseGame.webp', 'Bronze', 'victory'),
  ('variant_descending', 'Descendante', 'Jouer une partie en variante descendante.', '/images/achievements/Bronze/Medals_Descendante.webp', 'Bronze', 'variant'),
  ('variant_ascending', 'Montante', 'Jouer une partie en variante montante.', '/images/achievements/Bronze/Medals_Montante.webp', 'Bronze', 'variant'),
  ('level_5', 'Niveau 5', 'Atteindre le niveau 5.', '/images/achievements/Bronze/Medals_Lv5.webp', 'Bronze', 'level'),
  ('level_10', 'Niveau 10', 'Atteindre le niveau 10.', '/images/achievements/Bronze/Medals_Lv10.webp', 'Bronze', 'level'),
  ('score_200', 'Score 200', 'Marquer au moins 200 points.', '/images/achievements/Silver/Medals_200Score.webp', 'Silver', 'score'),
  ('streak_3', 'Série de 3', 'Gagner 3 parties de suite.', '/images/achievements/Silver/Medals_3Streak.webp', 'Silver', 'streak'),
  ('streak_5', 'Série de 5', 'Gagner 5 parties de suite.', '/images/achievements/Silver/Medals_5Streak.webp', 'Silver', 'streak'),
  ('bonus', 'Bonus supérieur', 'Obtenir le bonus de la section supérieure.', '/images/achievements/Silver/Medals_Bonus.webp', 'Silver', 'score'),
  ('win_game', 'Première victoire', 'Gagner une partie.', '/images/achievements/Silver/Medals_WinGame.webp', 'Silver', 'victory'),
  ('level_20', 'Niveau 20', 'Atteindre le niveau 20.', '/images/achievements/Silver/Medals_Lv20.webp', 'Silver', 'level'),
  ('level_30', 'Niveau 30', 'Atteindre le niveau 30.', '/images/achievements/Silver/Medals_Lv30.webp', 'Silver', 'level'),
  ('score_250', 'Score 250', 'Marquer au moins 250 points.', '/images/achievements/Gold/Medals_250Score.webp', 'Gold', 'score'),
  ('streak_10', 'Série de 10', 'Gagner 10 parties de suite.', '/images/achievements/Gold/Medals_10Streak.webp', 'Gold', 'streak'),
  ('level_40', 'Niveau 40', 'Atteindre le niveau 40.', '/images/achievements/Gold/Medals_Lv40.webp', 'Gold', 'level'),
  ('yams', 'Yams !', 'Réaliser un Yams.', '/images/achievements/Gold/Medals_Yams.webp', 'Gold', 'gameplay'),
  ('yams_1', 'Yams de 1', 'Réaliser un Yams de 1.', '/images/achievements/Gold/Medals_Yams1.webp', 'Gold', 'gameplay'),
  ('yams_2', 'Yams de 2', 'Réaliser un Yams de 2.', '/images/achievements/Gold/Medals_Yams2.webp', 'Gold', 'gameplay'),
  ('yams_3', 'Yams de 3', 'Réaliser un Yams de 3.', '/images/achievements/Gold/Medals_Yams3.webp', 'Gold', 'gameplay'),
  ('yams_4', 'Yams de 4', 'Réaliser un Yams de 4.', '/images/achievements/Gold/Medals_Yams4.webp', 'Gold', 'gameplay'),
  ('yams_5', 'Yams de 5', 'Réaliser un Yams de 5.', '/images/achievements/Gold/Medals_Yams5.webp', 'Gold', 'gameplay'),
  ('yams_6', 'Yams de 6', 'Réaliser un Yams de 6.', '/images/achievements/Gold/Medals_Yams6.webp', 'Gold', 'gameplay'),
  ('score_300', 'Score 300', 'Marquer au moins 300 points.', '/images/achievements/Crystal/Medals_300Score_Text.webp', 'Crystal', 'score'),
  ('champion', 'Champion', 'Atteindre au moins 75% de victoires après 10 parties.', '/images/achievements/Crystal/Medals_Champion_Text.webp', 'Crystal', 'victory'),
  ('level_50', 'Niveau 50', 'Atteindre le niveau 50.', '/images/achievements/Crystal/Medals_Lv50_Text.webp', 'Crystal', 'level'),
  ('perfect_game', 'Partie parfaite', 'Réaliser une partie parfaite.', '/images/achievements/Crystal/SMedals_PerfectGame_Text.webp', 'Crystal', 'score'),
  ('level_33', 'Niveau 33', 'Atteindre le niveau 33.', '/images/achievements/Crystal/SMedals_Lv33_Text.webp', 'Crystal', 'level'),
  ('win_ayun', 'Défier Ayun', 'Gagner contre Ayun.', '/images/achievements/Crystal/SMedals_Ayun_Text.webp', 'Crystal', 'special')
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

GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT SELECT ON public.achievements_with_rarity_rank TO anon, authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(UUID, TEXT) TO anon, authenticated, service_role;

-- =====================================================
-- Fin de la migration
-- =====================================================
