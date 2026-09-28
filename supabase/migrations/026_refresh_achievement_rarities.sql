-- Refresh the achievement catalogue to match the five new medal families.
-- Existing achievement identifiers are intentionally retained so previously
-- unlocked medals stay associated with their owners.

BEGIN;

-- The historical constraint only accepts the English rarity names.  Remove it
-- before inserting or updating rows with the five new French rarity values.
ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_rarity_check;

-- Some older environments were created from the migrations rather than the
-- bootstrap script and do not contain this part of the catalogue yet.
INSERT INTO public.achievements (
  id, name, description, image_path, rarity, category, is_active
)
VALUES
  ('all_in_one', 'All-in-One', 'Faire une partie "All-in-One".', '/images/achievements/Bronze/Medals_Bronze_AllInOne.webp', 'Bronze', 'variant', FALSE),
  ('friend_1', 'Premier ami', 'Ajouter son premier ami.', '/images/achievements/Argent/Medals_Argent_AddFriend.webp', 'Argent', 'action', FALSE),
  ('top_1', 'Top 1', 'Atteindre le top 1 du classement.', '/images/achievements/Obsidienne/Medals_Obsidienne_Top1.webp', 'Obsidienne', 'classement', TRUE),
  ('top_3', 'Top 3', 'Atteindre le top 3 du classement.', '/images/achievements/Or/Medals_Or_Top3.webp', 'Or', 'classement', TRUE),
  ('top_5', 'Top 5', 'Atteindre le top 5 du classement.', '/images/achievements/Argent/Medals_Argent_Top5.webp', 'Argent', 'classement', TRUE),
  ('yatzhee', 'Yahtzee', 'Gagner une partie en réalisant un Yahtzee.', '/images/achievements/Obsidienne/Medals_Obsidienne_Yahtzee.webp', 'Obsidienne', 'special', TRUE)
ON CONFLICT (id) DO NOTHING;

WITH catalogue(id, image_path, rarity) AS (
  VALUES
    ('all_in_one', '/images/achievements/Bronze/Medals_Bronze_AllInOne.webp', 'Bronze'),
    ('create_game', '/images/achievements/Bronze/Medals_Bronze_CreateGame.webp', 'Bronze'),
    ('create_private_game', '/images/achievements/Bronze/Medals_Bronze_CreatePrivateGame.webp', 'Bronze'),
    ('give_up', '/images/achievements/Bronze/Medals_Bronze_GiveUp.webp', 'Bronze'),
    ('join_game', '/images/achievements/Bronze/Medals_Bronze_JoinGame.webp', 'Bronze'),
    ('level_5', '/images/achievements/Bronze/Medals_Bronze_Lv5.webp', 'Bronze'),
    ('level_10', '/images/achievements/Bronze/Medals_Bronze_Lv10.webp', 'Bronze'),
    ('loose_game', '/images/achievements/Bronze/Medals_Bronze_LoseGame.webp', 'Bronze'),
    ('play_game', '/images/achievements/Bronze/Medals_Bronze_PlayGame.webp', 'Bronze'),
    ('variant_ascending', '/images/achievements/Bronze/Medals_Bronze_Montante.webp', 'Bronze'),
    ('variant_descending', '/images/achievements/Bronze/Medals_Bronze_Descendante.webp', 'Bronze'),
    ('bonus', '/images/achievements/Argent/Medals_Argent_Bonus.webp', 'Argent'),
    ('friend_1', '/images/achievements/Argent/Medals_Argent_AddFriend.webp', 'Argent'),
    ('level_20', '/images/achievements/Argent/Medals_Argent_Lv20.webp', 'Argent'),
    ('level_30', '/images/achievements/Argent/Medals_Argent_Lv30.webp', 'Argent'),
    ('score_200', '/images/achievements/Argent/Medals_Argent_200Score.webp', 'Argent'),
    ('streak_3', '/images/achievements/Argent/Medals_Argent_3Streak.webp', 'Argent'),
    ('top_5', '/images/achievements/Argent/Medals_Argent_Top5.webp', 'Argent'),
    ('win_game', '/images/achievements/Argent/Medals_Argent_WinGame.webp', 'Argent'),
    ('level_40', '/images/achievements/Or/Medals_Or_Lv40.webp', 'Or'),
    ('score_250', '/images/achievements/Or/Medals_Or_250Score.webp', 'Or'),
    ('streak_5', '/images/achievements/Or/Medals_Or_5Streak.webp', 'Or'),
    ('top_3', '/images/achievements/Or/Medals_Or_Top3.webp', 'Or'),
    ('yams', '/images/achievements/Or/Medals_Or_Yams.webp', 'Or'),
    ('yams_1', '/images/achievements/Or/Medals_Or_Yams1.webp', 'Or'),
    ('yams_2', '/images/achievements/Or/Medals_Or_Yams2.webp', 'Or'),
    ('yams_3', '/images/achievements/Or/Medals_Or_Yams3.webp', 'Or'),
    ('yams_4', '/images/achievements/Or/Medals_Or_Yams4.webp', 'Or'),
    ('yams_5', '/images/achievements/Or/Medals_Or_Yams5.webp', 'Or'),
    ('yams_6', '/images/achievements/Or/Medals_Or_Yams6.webp', 'Or'),
    ('bug_finder', '/images/achievements/Rubis/Medals_Rubis_BugFinder.webp', 'Rubis'),
    ('champion', '/images/achievements/Rubis/Medals_Rubis_Champion.webp', 'Rubis'),
    ('level_33', '/images/achievements/Rubis/Medals_Rubis_Lv33.webp', 'Rubis'),
    ('perfect_game', '/images/achievements/Rubis/Medals_Rubis_PerfectGame.webp', 'Rubis'),
    ('score_300', '/images/achievements/Obsidienne/Medals_Obsidienne_300Score.webp', 'Obsidienne'),
    ('level_50', '/images/achievements/Obsidienne/Medals_Obsidienne_Lv50.webp', 'Obsidienne'),
    ('top_1', '/images/achievements/Obsidienne/Medals_Obsidienne_Top1.webp', 'Obsidienne'),
    ('yatzhee', '/images/achievements/Obsidienne/Medals_Obsidienne_Yahtzee.webp', 'Obsidienne')
)
UPDATE public.achievements AS achievement
SET image_path = catalogue.image_path,
    rarity = catalogue.rarity
FROM catalogue
WHERE achievement.id = catalogue.id;

-- The only display-name correction directly established by the supplied asset.
UPDATE public.achievements
SET name = 'Yahtzee'
WHERE id = 'yatzhee';

-- The new Bronze Top 10 replaces the retired Top 2 medal.  It is deliberately
-- a new id: changing an existing id would rewrite users' historical unlocks.
INSERT INTO public.achievements (
  id, name, description, image_path, rarity, category, is_active
)
VALUES (
  'top_10', 'Top 10', 'Atteindre le top 10 du classement.',
  '/images/achievements/Bronze/Medals_Bronze_Top10.webp', 'Bronze', 'classement', TRUE
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_path = EXCLUDED.image_path,
    rarity = EXCLUDED.rarity,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;

-- These medals no longer have an asset in the new catalogue.  Keep their rows
-- (and users' past unlocks), but do not expose or award them again.
UPDATE public.achievements
SET is_active = FALSE,
    rarity = CASE id
      WHEN 'win_all_in_one' THEN 'Argent'
      WHEN 'streak_10' THEN 'Or'
      WHEN 'top_2' THEN 'Or'
      WHEN 'win_ayun' THEN 'Obsidienne'
      ELSE rarity
    END
WHERE id IN ('win_all_in_one', 'streak_10', 'top_2', 'win_ayun');

-- No row may retain one of the legacy English rarity values before tightening
-- the database constraint.  Failing here is intentional: it protects any
-- custom achievement not represented by the supplied medal assets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.achievements
    WHERE rarity NOT IN ('Bronze', 'Argent', 'Or', 'Rubis', 'Obsidienne')
  ) THEN
    RAISE EXCEPTION 'Achievement rarity migration is missing one or more catalogue entries';
  END IF;
END;
$$;

ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_rarity_check
  CHECK (rarity IN ('Bronze', 'Argent', 'Or', 'Rubis', 'Obsidienne'));

CREATE OR REPLACE VIEW public.achievements_with_rarity_rank AS
SELECT
  achievement.*,
  CASE achievement.rarity
    WHEN 'Bronze' THEN 0
    WHEN 'Argent' THEN 1
    WHEN 'Or' THEN 2
    WHEN 'Rubis' THEN 3
    WHEN 'Obsidienne' THEN 4
  END AS rarity_rank
FROM public.achievements AS achievement
WHERE achievement.is_active IS TRUE;

-- Guard against code paths attempting to grant one of the archived medals.
CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.achievements
    WHERE id = p_achievement_id
      AND is_active IS TRUE
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

COMMIT;
