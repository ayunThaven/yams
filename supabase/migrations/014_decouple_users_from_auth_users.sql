-- =====================================================
-- Migration : Découpler public.users de auth.users
-- Objectif : garder public.users + auth_local_users liés entre eux,
--            sans dépendre de Supabase Auth pour les nouveaux comptes.
-- =====================================================

-- 1) Supprimer la contrainte FK users.id -> auth.users.id si elle existe
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2) Supprimer le trigger qui créait automatiquement un profil users
--    à partir de auth.users (on ne s'appuie plus sur ce mécanisme)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3) Supprimer la fonction de trigger correspondante si elle existe
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Remarque :
-- - public.users conserve la même structure (id UUID PRIMARY KEY, stats, etc.).
-- - Les RLS et la vue leaderboard restent valides.
-- - Pour les nouveaux comptes, le backend crée explicitement :
--     1) une ligne dans auth_local_users (email + mot de passe)
--     2) une ligne dans public.users avec le même id
--   sans passer par auth.users.


