-- =====================================================
-- Migration : Lier auth_local_users à public.users
--             + migrer les utilisateurs existants
-- =====================================================

-- 1) Ajouter une contrainte de FK pour garantir que chaque auth_local_users
--    pointe vers un profil dans public.users (même id)
ALTER TABLE public.auth_local_users
ADD CONSTRAINT auth_local_users_users_fk
FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 2) Migrer les utilisateurs existants :
--    On crée une ligne auth_local_users pour chaque profil existant dans public.users
--    en réutilisant le même id et l'email depuis auth.users.
--
-- ⚠️ IMPORTANT :
-- - On ne peut PAS récupérer les mots de passe de Supabase Auth (hashés côté Supabase).
-- - On met donc un hash "jetable" qui ne correspond à aucun mot de passe connu.
-- - Ces utilisateurs devront définir un nouveau mot de passe via un futur flux
--   "réinitialiser / définir mon mot de passe".

INSERT INTO public.auth_local_users (id, email, password_hash, email_verified, created_at)
SELECT
  u.id,
  a.email,
  -- Hash bcrypt d'une valeur aléatoire inconnue (à adapter si besoin)
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8e5vE1VlzDqgW8sELpAo0P5NdIZ4Cy' AS password_hash,
  TRUE AS email_verified,
  COALESCE(u.created_at, NOW()) AS created_at
FROM public.users u
JOIN auth.users a ON a.id = u.id
ON CONFLICT (id) DO NOTHING;

-- Note :
-- - Les stats, usernames, avatars restent dans public.users (inchangés).
-- - auth_local_users ne sert qu'à l'authentification (email + password_hash + email_verified).
-- - Le code Node utilise déjà le même id partout, donc tout restera cohérent.

