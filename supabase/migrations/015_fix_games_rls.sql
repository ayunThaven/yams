-- =====================================================
-- Migration : Simplifier/neutraliser la RLS sur public.games
-- Objectif : ne plus dépendre de auth.uid() / Supabase Auth
--            pour la création/mise à jour des parties.
-- =====================================================

-- 1) Désactiver la Row Level Security sur public.games
--    Toute la sécurité applicative est désormais gérée
--    côté backend (API Next + serveur Socket) en utilisant
--    la clé service role.
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;

-- 2) (Optionnel) Supprimer les anciennes policies liées à auth.uid()
--    On les enlève pour éviter toute confusion future.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games'
  ) THEN
    -- Les noms exacts peuvent varier, on supprime tout ce qui est sur games
    DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent créer des parties" ON public.games;
    DROP POLICY IF EXISTS "L'hôte peut mettre à jour sa partie" ON public.games;
    DROP POLICY IF EXISTS "Les parties sont visibles par tous" ON public.games;
  END IF;
END $$;

-- Note :
-- - Toutes les lectures/écritures sur games passent désormais
--   par createAdminClient (clé service_role) dans :
--     - API /api/games, /api/history, /api/games/[id]/meta
--     - serveur Socket.IO (server.ts + socketRoomHandlers)
-- - Il n'y a donc plus de dépendance à auth.uid() ni à Supabase Auth.


