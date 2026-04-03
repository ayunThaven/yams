-- =====================================================
-- Migration : Ajouter max_players à la table games
-- =====================================================

-- Ajouter la colonne max_players avec une valeur par défaut de 4
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 8);

-- Mettre à jour les parties existantes pour avoir max_players = 4
UPDATE public.games 
SET max_players = 4 
WHERE max_players IS NULL;

-- Commenter la colonne
COMMENT ON COLUMN public.games.max_players IS 'Nombre maximum de joueurs autorisés dans la partie (entre 2 et 8)';

-- =====================================================
-- Fin de la migration
-- =====================================================

