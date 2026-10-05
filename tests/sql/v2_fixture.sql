-- Disposable PostgreSQL fixture. Run only against the dedicated test database.
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  serie_victoires_actuelle INTEGER NOT NULL DEFAULT 0,
  meilleure_serie_victoires INTEGER NOT NULL DEFAULT 0,
  parties_jouees INTEGER NOT NULL DEFAULT 0,
  parties_gagnees INTEGER NOT NULL DEFAULT 0,
  parties_abandonnees INTEGER NOT NULL DEFAULT 0,
  meilleur_score INTEGER NOT NULL DEFAULT 0,
  nombre_yams_realises INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.games (
  id TEXT PRIMARY KEY,
  host_id UUID,
  owner UUID,
  status TEXT NOT NULL DEFAULT 'waiting',
  winner TEXT,
  players_scores JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\if :old_auth_fk
ALTER TABLE public.games ADD CONSTRAINT games_owner_fkey FOREIGN KEY(owner) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.games ADD CONSTRAINT games_host_id_fkey FOREIGN KEY(host_id) REFERENCES auth.users(id) ON DELETE CASCADE;
\else
ALTER TABLE public.games ADD CONSTRAINT games_owner_fkey FOREIGN KEY(owner) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.games ADD CONSTRAINT games_host_id_fkey FOREIGN KEY(host_id) REFERENCES public.users(id) ON DELETE SET NULL;
\endif

CREATE TABLE public.game_players (
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(game_id, user_id)
);
CREATE TABLE public.game_results (
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  won BOOLEAN NOT NULL,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  yams_count INTEGER NOT NULL DEFAULT 0,
  yams_faces SMALLINT[] NOT NULL DEFAULT '{}',
  xp_gained INTEGER NOT NULL DEFAULT 0,
  score_sheet JSONB NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT 'completed',
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(game_id, user_id)
);
CREATE TABLE public.game_score_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  dice_values SMALLINT[] NOT NULL,
  score INTEGER NOT NULL,
  total_after INTEGER NOT NULL,
  yams_face SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id, category)
);
CREATE TABLE public.game_player_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE FUNCTION public.handle_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;
CREATE FUNCTION public.xp_for_level(p_level INTEGER) RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT p_level * 100
$$;
CREATE FUNCTION public.level_from_xp(p_xp INTEGER) RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT LEAST(50, GREATEST(1, 1 + p_xp / 100))
$$;
CREATE FUNCTION public.update_user_stats(
  p_user_id UUID, p_score INTEGER, p_won BOOLEAN, p_abandoned BOOLEAN,
  p_yams_count INTEGER, p_xp_gained INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users SET parties_jouees = parties_jouees + 1,
    parties_gagnees = parties_gagnees + CASE WHEN p_won THEN 1 ELSE 0 END,
    parties_abandonnees = parties_abandonnees + CASE WHEN p_abandoned THEN 1 ELSE 0 END,
    xp = GREATEST(0, xp + p_xp_gained)
  WHERE id = p_user_id;
END $$;
CREATE FUNCTION public.save_game_snapshot(TEXT, JSONB, INTEGER, TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE sql AS $$ SELECT 1 $$;

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');
INSERT INTO public.users(id) SELECT id FROM auth.users;
INSERT INTO public.games(id, owner, host_id, status) VALUES
  ('FINISH01', NULL, NULL, 'finished'),
  ('FINISH02', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'finished'),
  ('HOSTONLY', NULL, '00000000-0000-0000-0000-000000000003', 'finished'),
  ('ACTIVEH1', NULL, '00000000-0000-0000-0000-000000000003', 'in_progress'),
  ('GAMEA001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'in_progress'),
  ('GAMEA002', '00000000-0000-0000-0000-000000000001', NULL, 'finished');
INSERT INTO public.game_results(game_id, user_id, player_name, score, won) VALUES
  ('FINISH02', '00000000-0000-0000-0000-000000000001', 'Alice', 80, TRUE);
INSERT INTO public.game_score_actions(
  game_id, user_id, player_name, turn_number, category, dice_values, score, total_after
) VALUES (
  'GAMEA001', '00000000-0000-0000-0000-000000000002', 'Brian', 1, 'ones', ARRAY[1,1,2,3,4]::SMALLINT[], 2, 2
);
