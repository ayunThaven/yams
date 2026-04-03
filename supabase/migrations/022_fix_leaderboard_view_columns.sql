-- =====================================================
-- Migration : Corriger la vue leaderboard pour inclure toutes les colonnes nécessaires
-- =====================================================

-- Mettre à jour la vue leaderboard avec toutes les colonnes nécessaires
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  id,
  username,
  avatar_url,
  parties_jouees,
  parties_gagnees,
  parties_abandonnees,
  meilleur_score,
  nombre_yams_realises,
  meilleure_serie_victoires,
  serie_victoires_actuelle,
  xp,
  level,
  created_at,
  updated_at,
  -- Calculer le taux de victoire en pourcentage
  CASE 
    WHEN parties_jouees > 0 
    THEN ROUND((parties_gagnees::DECIMAL / parties_jouees * 100), 2)
    ELSE 0 
  END as taux_victoire
FROM public.users
WHERE parties_jouees > 0;

-- S'assurer que les permissions sont correctes
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO anon;

-- =====================================================
-- Fin de la migration
-- =====================================================

