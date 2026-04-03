-- =====================================================
-- Migration : Ajouter les scores des joueurs à la table games
-- =====================================================

-- Ajouter une colonne JSONB pour stocker les scores de tous les joueurs
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS players_scores JSONB DEFAULT '[]'::jsonb;

-- Créer un index pour améliorer les performances des requêtes sur players_scores
CREATE INDEX IF NOT EXISTS idx_games_players_scores ON public.games USING gin(players_scores);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.games.players_scores IS 'Scores de tous les joueurs au format JSON: [{"id": "socketId", "name": "username", "score": 123, "abandoned": false}]';

-- =====================================================
-- Fin de la migration
-- =====================================================

