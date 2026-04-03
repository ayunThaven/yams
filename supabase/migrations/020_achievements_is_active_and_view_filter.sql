-- =====================================================
-- Migration : Flag d'activation des achievements
--            + filtre de la vue sur les achievements actifs
-- =====================================================

-- 1. Ajouter une colonne is_active sur achievements
ALTER TABLE public.achievements
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Recréer la vue de tri en ne gardant que les achievements actifs
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
FROM public.achievements a
WHERE a.is_active IS TRUE;

-- Pour désactiver (cacher) un achievement, il suffit de passer is_active à FALSE :
--   UPDATE public.achievements SET is_active = FALSE WHERE id = 'mon_achievement_id';

-- =====================================================
-- Fin de la migration
-- =====================================================


