-- =====================================================
-- Migration : Bloquer le niveau et l'XP à 50
-- =====================================================

-- 1. Modifier la contrainte CHECK sur la colonne level pour limiter à 50 maximum
-- Supprimer l'ancienne contrainte (PostgreSQL génère généralement un nom comme users_level_check)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Trouver le nom de la contrainte CHECK sur la colonne level
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%level%>=%1%';
    
    -- Supprimer la contrainte si elle existe
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Ajouter la nouvelle contrainte avec limite à 50
ALTER TABLE public.users
ADD CONSTRAINT users_level_check CHECK (level >= 1 AND level <= 50);

-- 2. Modifier la fonction level_from_xp pour retourner au maximum 50
CREATE OR REPLACE FUNCTION public.level_from_xp(
  p_xp INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_xp_for_current_level INTEGER;
BEGIN
  -- Si XP est 0 ou négatif, level 1
  IF p_xp <= 0 THEN
    RETURN 1;
  END IF;
  
  -- Chercher le level maximum
  LOOP
    v_xp_for_current_level := public.xp_for_level(v_level + 1);
    
    -- Si l'XP nécessaire pour le level suivant dépasse l'XP total, on a trouvé le level
    IF v_xp_for_current_level > p_xp THEN
      -- Bloquer le niveau à 50 maximum
      RETURN LEAST(v_level, 50);
    END IF;
    
    v_level := v_level + 1;
    
    -- Sécurité: éviter les boucles infinies (level max 50)
    IF v_level > 50 THEN
      RETURN 50;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Modifier la fonction update_user_stats pour bloquer l'XP et le niveau à 50
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
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_for_level_50 INTEGER;
BEGIN
  -- Récupérer les valeurs actuelles
  SELECT 
    serie_victoires_actuelle,
    COALESCE(xp, 0),
    COALESCE(level, 1)
  INTO 
    v_current_serie,
    v_current_xp,
    v_current_level
  FROM public.users
  WHERE id = p_user_id;

  -- Si le joueur est déjà au niveau 50, ne pas ajouter d'XP
  IF v_current_level >= 50 THEN
    v_new_xp := v_current_xp;
    v_new_level := 50;
  ELSE
    -- Calculer le nouvel XP et le nouveau level
    -- S'assurer que l'XP ne devient jamais négatif (pour gérer les pertes d'XP)
    v_new_xp := GREATEST(0, v_current_xp + p_xp_gained);
    v_new_level := public.level_from_xp(v_new_xp);
    
    -- Bloquer le niveau à 50 maximum
    IF v_new_level > 50 THEN
      v_new_level := 50;
      -- Calculer l'XP maximum pour le niveau 50
      v_xp_for_level_50 := public.xp_for_level(50);
      -- Limiter l'XP à la valeur nécessaire pour le niveau 50
      v_new_xp := LEAST(v_new_xp, v_xp_for_level_50);
    END IF;
  END IF;

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

