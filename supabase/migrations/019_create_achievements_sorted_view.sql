-- =====================================================
-- Migration : Vue de tri des achievements par rareté + nom
-- =====================================================

CREATE OR REPLACE VIEW public.achievements_with_rarity_rank AS
SELECT
  a.*,
  CASE LOWER(a.rarity)
    WHEN 'bronze' THEN 0
    WHEN 'silver' THEN 1
    WHEN 'gold' THEN 2
    WHEN 'crystal' THEN 3
    ELSE 99
  END AS rarity_rank
FROM public.achievements a;

-- Pas de RLS sur la vue, les policies de la table sous-jacente s'appliquent.

-- =====================================================
-- Fin de la migration
-- =====================================================


