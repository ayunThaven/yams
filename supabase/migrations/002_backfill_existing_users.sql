-- =====================================================
-- Migration : Synchronisation des utilisateurs existants
-- =====================================================
-- Ce script copie tous les utilisateurs existants de auth.users 
-- vers public.users s'ils n'y sont pas déjà

-- Insérer les utilisateurs existants qui n'ont pas encore de profil
INSERT INTO public.users (id, username, avatar_url, created_at)
SELECT 
  au.id,
  -- Utiliser le username depuis les métadonnées, sinon la partie avant @ de l'email
  COALESCE(
    au.raw_user_meta_data->>'username',
    SPLIT_PART(au.email, '@', 1),
    'Joueur_' || SUBSTRING(au.id::text, 1, 8)
  ) as username,
  -- Générer un avatar unique basé sur l'ID
  CONCAT('https://api.dicebear.com/7.x/avataaars/svg?seed=', au.id) as avatar_url,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL  -- Seulement les utilisateurs qui n'existent pas encore dans public.users
ON CONFLICT (id) DO NOTHING;  -- Au cas où il y aurait une race condition

-- Afficher le nombre d'utilisateurs synchronisés
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✅ % utilisateur(s) existant(s) synchronisé(s) vers public.users', inserted_count;
END $$;

-- =====================================================
-- Fin de la migration de backfill
-- =====================================================