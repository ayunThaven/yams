-- =====================================================
-- Migration : Ajouter xp et level à la vue leaderboard
-- =====================================================

-- Mettre à jour la vue leaderboard pour inclure xp et level
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
WHERE parties_jouees > 0
-- Tri : d'abord par taux de victoire, puis par nombre de victoires, puis par meilleur score
ORDER BY 
  CASE 
    WHEN parties_jouees > 0 
    THEN ROUND((parties_gagnees::DECIMAL / parties_jouees * 100), 2)
    ELSE 0 
  END DESC,
  parties_gagnees DESC,
  meilleur_score DESC;

-- =====================================================
-- Fin de la migration
-- =====================================================

