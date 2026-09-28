-- Rubis is the rarest medal family and must be listed last in the collection.

CREATE OR REPLACE VIEW public.achievements_with_rarity_rank AS
SELECT
  achievement.*,
  CASE achievement.rarity
    WHEN 'Bronze' THEN 0
    WHEN 'Argent' THEN 1
    WHEN 'Or' THEN 2
    WHEN 'Obsidienne' THEN 3
    WHEN 'Rubis' THEN 4
  END AS rarity_rank
FROM public.achievements AS achievement
WHERE achievement.is_active IS TRUE;
