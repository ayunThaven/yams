-- =====================================================
-- Migration : Modifier la table games pour accepter des IDs courts
-- =====================================================

-- Si la table games existe déjà, la modifier
-- Sinon, la créer avec le bon type

-- 1. Supprimer les contraintes et modifier le type si la table existe
DO $$ 
BEGIN
    -- Vérifier si la table existe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'games') THEN
        -- Modifier le type de la colonne id
        ALTER TABLE public.games ALTER COLUMN id TYPE TEXT;
        RAISE NOTICE 'Table games modifiée : id est maintenant de type TEXT';
    ELSE
        -- Créer la table games avec le bon type
        CREATE TABLE public.games (
            id TEXT PRIMARY KEY,
            host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            owner UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished', 'server_interrupted')),
            winner TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Créer des index
        CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
        CREATE INDEX IF NOT EXISTS idx_games_host_id ON public.games(host_id);
        CREATE INDEX IF NOT EXISTS idx_games_created_at ON public.games(created_at DESC);
        
        -- Activer RLS
        ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
        
        -- Policy : Tout le monde peut voir les parties
        CREATE POLICY "Les parties sont visibles par tous"
            ON public.games
            FOR SELECT
            USING (true);
        
        -- Policy : Les utilisateurs authentifiés peuvent créer des parties
        CREATE POLICY "Les utilisateurs authentifiés peuvent créer des parties"
            ON public.games
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = host_id OR auth.uid() = owner);
        
        -- Policy : L'hôte peut mettre à jour sa partie
        CREATE POLICY "L'hôte peut mettre à jour sa partie"
            ON public.games
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = host_id OR auth.uid() = owner);
        
        -- Trigger pour updated_at
        CREATE TRIGGER set_games_updated_at
            BEFORE UPDATE ON public.games
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
        
        RAISE NOTICE 'Table games créée avec succès';
    END IF;
END $$;

-- 2. Commenter la table et les colonnes
COMMENT ON TABLE public.games IS 'Parties de Yams';
COMMENT ON COLUMN public.games.id IS 'Identifiant court de la partie (8 caractères)';
COMMENT ON COLUMN public.games.host_id IS 'ID de l''hôte de la partie';
COMMENT ON COLUMN public.games.status IS 'Statut de la partie';
COMMENT ON COLUMN public.games.winner IS 'ID du gagnant';

-- =====================================================
-- Fin de la migration
-- =====================================================

