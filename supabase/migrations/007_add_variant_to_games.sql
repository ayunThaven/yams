-- =====================================================
-- Migration : Ajouter la colonne variant à la table games
-- =====================================================

-- Ajouter la colonne variant avec une valeur par défaut 'classic'
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'classic' CHECK (variant IN ('classic', 'descending', 'ascending'));

-- Créer un index pour améliorer les performances des requêtes filtrées par variant
CREATE INDEX IF NOT EXISTS idx_games_variant ON public.games(variant);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.games.variant IS 'Type de variante : classic (libre choix), descending (du haut vers le bas), ascending (du bas vers le haut)';

-- =====================================================
-- Fin de la migration
-- =====================================================

