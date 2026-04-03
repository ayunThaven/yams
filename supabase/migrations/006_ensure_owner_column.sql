-- =====================================================
-- Migration : S'assurer que la colonne owner existe
-- =====================================================

-- Ajouter la colonne owner si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'games' 
        AND column_name = 'owner'
    ) THEN
        ALTER TABLE public.games ADD COLUMN owner UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Colonne owner ajoutée à la table games';
    ELSE
        RAISE NOTICE 'Colonne owner existe déjà';
    END IF;
END $$;

-- Créer un index sur owner si il n'existe pas
CREATE INDEX IF NOT EXISTS idx_games_owner ON public.games(owner);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.games.owner IS 'ID du propriétaire/créateur de la partie';

-- Mettre à jour les policies pour utiliser seulement owner
-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent créer des parties" ON public.games;
DROP POLICY IF EXISTS "L'hôte peut mettre à jour sa partie" ON public.games;

-- Recréer les policies avec seulement owner
CREATE POLICY "Les utilisateurs authentifiés peuvent créer des parties"
    ON public.games
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner);

CREATE POLICY "Le propriétaire peut mettre à jour sa partie"
    ON public.games
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner);

-- =====================================================
-- Fin de la migration
-- =====================================================

