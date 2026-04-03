-- =====================================================
-- Migration : Table public.users avec stats de jeu
-- =====================================================

-- 1. Créer la table users
CREATE TABLE IF NOT EXISTS public.users (
  -- Identité
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  
  -- Stats de base
  parties_jouees INTEGER DEFAULT 0 CHECK (parties_jouees >= 0),
  parties_gagnees INTEGER DEFAULT 0 CHECK (parties_gagnees >= 0),
  parties_abandonnees INTEGER DEFAULT 0 CHECK (parties_abandonnees >= 0),
  
  -- Scores
  meilleur_score INTEGER DEFAULT 0 CHECK (meilleur_score >= 0),
  
  -- Records spéciaux
  nombre_yams_realises INTEGER DEFAULT 0 CHECK (nombre_yams_realises >= 0),
  meilleure_serie_victoires INTEGER DEFAULT 0 CHECK (meilleure_serie_victoires >= 0),
  serie_victoires_actuelle INTEGER DEFAULT 0 CHECK (serie_victoires_actuelle >= 0),
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_meilleur_score ON public.users(meilleur_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_parties_gagnees ON public.users(parties_gagnees DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- 3. Créer une vue pour le classement (leaderboard)
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  id,
  username,
  avatar_url,
  parties_jouees,
  parties_gagnees,
  meilleur_score,
  nombre_yams_realises,
  meilleure_serie_victoires,
  -- Calculer le taux de victoire en pourcentage
  CASE 
    WHEN parties_jouees > 0 
    THEN ROUND((parties_gagnees::DECIMAL / parties_jouees * 100), 2)
    ELSE 0 
  END as taux_victoire
FROM public.users
WHERE parties_jouees > 0
ORDER BY meilleur_score DESC, parties_gagnees DESC;

-- 4. Fonction trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Appliquer le trigger sur la table users
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Fonction pour créer automatiquement un profil utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1),
      'Joueur'
    ),
    CONCAT('https://api.dicebear.com/7.x/avataaars/svg?seed=', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger qui s'exécute à chaque nouvelle inscription
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Fonction utilitaire pour mettre à jour les stats après une partie
CREATE OR REPLACE FUNCTION public.update_user_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_won BOOLEAN,
  p_abandoned BOOLEAN DEFAULT FALSE,
  p_yams_count INTEGER DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_current_serie INTEGER;
BEGIN
  -- Récupérer la série actuelle
  SELECT serie_victoires_actuelle INTO v_current_serie
  FROM public.users
  WHERE id = p_user_id;

  -- Mettre à jour les stats
  UPDATE public.users
  SET 
    parties_jouees = parties_jouees + 1,
    parties_gagnees = CASE WHEN p_won THEN parties_gagnees + 1 ELSE parties_gagnees END,
    parties_abandonnees = CASE WHEN p_abandoned THEN parties_abandonnees + 1 ELSE parties_abandonnees END,
    meilleur_score = GREATEST(meilleur_score, p_score),
    nombre_yams_realises = nombre_yams_realises + p_yams_count,
    serie_victoires_actuelle = CASE 
      WHEN p_won THEN v_current_serie + 1 
      WHEN p_abandoned THEN v_current_serie
      ELSE 0 
    END,
    meilleure_serie_victoires = GREATEST(
      meilleure_serie_victoires,
      CASE WHEN p_won THEN v_current_serie + 1 ELSE v_current_serie END
    ),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 10. Policies RLS : Tout le monde peut lire les profils publics
CREATE POLICY "Les profils publics sont visibles par tous"
  ON public.users
  FOR SELECT
  USING (true);

-- 11. Policy RLS : Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 12. Policy RLS : Seul le système peut insérer (via trigger)
CREATE POLICY "Seul le système peut créer des profils"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 13. Permettre l'accès à la vue leaderboard
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO anon;

-- =====================================================
-- Commentaires sur les colonnes
-- =====================================================

COMMENT ON TABLE public.users IS 'Profils utilisateurs avec statistiques de jeu';
COMMENT ON COLUMN public.users.id IS 'UUID lié à auth.users';
COMMENT ON COLUMN public.users.username IS 'Nom d''utilisateur unique visible par tous';
COMMENT ON COLUMN public.users.avatar_url IS 'URL de l''avatar (Dicebear par défaut)';
COMMENT ON COLUMN public.users.parties_jouees IS 'Nombre total de parties complétées';
COMMENT ON COLUMN public.users.parties_gagnees IS 'Nombre de victoires';
COMMENT ON COLUMN public.users.meilleur_score IS 'Score le plus élevé obtenu';
COMMENT ON COLUMN public.users.nombre_yams_realises IS 'Nombre de fois où l''utilisateur a réalisé un Yams (5 dés identiques)';
COMMENT ON COLUMN public.users.meilleure_serie_victoires IS 'Plus longue série de victoires consécutives';
COMMENT ON COLUMN public.users.serie_victoires_actuelle IS 'Série de victoires en cours';

-- =====================================================
-- Fin de la migration
-- =====================================================

