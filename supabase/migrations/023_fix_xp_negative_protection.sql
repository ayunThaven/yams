-- =====================================================
-- Migration : Protection contre XP négatif
-- =====================================================

-- Mettre à jour la fonction update_user_stats pour s'assurer que l'XP ne devient jamais négatif
-- Cela permet de gérer les pertes d'XP (par exemple lors d'un abandon)
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
  -- Récupérer les valeurs actuelles
  SELECT 
    serie_victoires_actuelle,
    COALESCE(xp, 0)
  INTO 
    v_current_serie,
    v_current_xp
  FROM public.users
  WHERE id = p_user_id;

  -- Calculer le nouvel XP et le nouveau level (utilise les constantes globales)
  -- S'assurer que l'XP ne devient jamais négatif (pour gérer les pertes d'XP)
  v_new_xp := GREATEST(0, v_current_xp + p_xp_gained);
  v_new_level := public.level_from_xp(v_new_xp);

  -- Mettre à jour les stats
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Fin de la migration
-- =====================================================

