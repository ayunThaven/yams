-- =====================================================
-- Migration : Réinitialiser toutes les données des joueurs
-- =====================================================
-- ATTENTION : Cette requête remet à zéro TOUTES les stats, niveaux et succès de TOUS les joueurs
-- Utilisez avec précaution !
--
-- Cette migration :
-- 1. Réinitialise toutes les statistiques de jeu (parties, scores, séries)
-- 2. Réinitialise le système de leveling (XP et niveau)
-- 3. Supprime tous les achievements débloqués
-- =====================================================

-- 1. Réinitialiser toutes les statistiques et le leveling
UPDATE public.users
SET 
  -- Stats de base
  parties_jouees = 0,
  parties_gagnees = 0,
  parties_abandonnees = 0,
  
  -- Scores
  meilleur_score = 0,
  
  -- Records spéciaux
  nombre_yams_realises = 0,
  meilleure_serie_victoires = 0,
  serie_victoires_actuelle = 0,
  
  -- Système de leveling
  xp = 0,
  level = 1,
  
  -- Métadonnées
  updated_at = NOW();

-- 2. Supprimer tous les achievements débloqués
DELETE FROM public.user_achievements;

-- =====================================================
-- Fin de la migration
-- =====================================================
-- Note : Les comptes utilisateurs (username, avatar_url, etc.) sont conservés
-- Seules les données de progression sont réinitialisées

