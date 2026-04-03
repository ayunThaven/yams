-- =====================================================
-- Migration : Système de leveling (XP et Level)
-- =====================================================

-- 1. Ajouter les colonnes pour le système de leveling
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0 CHECK (xp >= 0),
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 CHECK (level >= 1);

-- 2. Constantes globales pour le système de leveling
-- Ces valeurs sont utilisées par toutes les fonctions de calcul
-- Pour les modifier, il faut mettre à jour les fonctions ci-dessous

-- 3. Créer une fonction pour calculer l'XP nécessaire pour un level donné
-- Formule: floor(base * ((growth^(level+1) - 1) / (growth - 1)))
-- Utilise les constantes globales: base = 30, growth = 1.1
CREATE OR REPLACE FUNCTION public.xp_for_level(
  p_level INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_base INTEGER := 10;
  v_growth DECIMAL := 1.05;
BEGIN
  IF p_level <= 0 THEN
    RETURN 0;
  END IF;
  
  RETURN FLOOR(v_base * ((POWER(v_growth, p_level + 1) - 1) / (v_growth - 1)))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
 
-- 4. Créer une fonction pour calculer le level à partir de l'XP
-- Trouve le level maximum tel que xp_for_level(level) <= xp_total
-- Utilise les constantes globales: base = 30, growth = 1.1
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
      RETURN v_level;
    END IF;
    
    v_level := v_level + 1;
    
    -- Sécurité: éviter les boucles infinies (level max 1000)
    IF v_level > 1000 THEN
      RETURN 1000;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Modifier la fonction update_user_stats pour gérer l'XP et le level
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
  v_new_xp := v_current_xp + p_xp_gained;
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

-- 6. Commentaires sur les nouvelles colonnes
COMMENT ON COLUMN public.users.xp IS 'Points d''expérience totaux accumulés';
COMMENT ON COLUMN public.users.level IS 'Niveau actuel du joueur (calculé à partir de l''XP)';

-- =====================================================
-- Fin de la migration
-- =====================================================

