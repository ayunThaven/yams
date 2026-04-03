-- =====================================================
-- Migration : Corriger le calcul du level
-- =====================================================

-- Recréer la fonction level_from_xp avec une logique plus claire
CREATE OR REPLACE FUNCTION public.level_from_xp(
  p_xp INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_xp_for_next_level INTEGER;
BEGIN
  -- Si XP est 0 ou négatif, level 1
  IF p_xp <= 0 THEN
    RETURN 1;
  END IF;
  
  -- Chercher le level maximum
  -- On cherche le level le plus élevé tel que xp_for_level(level + 1) <= xp
  -- Si xp_for_level(level + 1) > xp, alors on est au level actuel
  LOOP
    -- Calculer l'XP nécessaire pour atteindre le level suivant
    v_xp_for_next_level := public.xp_for_level(v_level + 1);
    
    -- Si l'XP nécessaire pour le level suivant dépasse l'XP total, on a trouvé le level
    IF v_xp_for_next_level > p_xp THEN
      RETURN v_level;
    END IF;
    
    -- Sinon, on peut passer au level suivant
    v_level := v_level + 1;
    
    -- Sécurité: éviter les boucles infinies (level max 1000)
    IF v_level > 1000 THEN
      RETURN 1000;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vérifier que la fonction update_user_stats met bien à jour le level
-- (Pas besoin de modifier, elle appelle déjà level_from_xp correctement)

-- =====================================================
-- Fin de la migration
-- =====================================================

