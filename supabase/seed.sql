-- Comptes de démonstration chargés par `supabase db reset`.
-- Mot de passe commun : Yams2026!

INSERT INTO public.users (
  id,
  username,
  avatar_url,
  parties_jouees,
  parties_gagnees,
  parties_abandonnees,
  meilleur_score,
  nombre_yams_realises,
  meilleure_serie_victoires,
  serie_victoires_actuelle,
  xp,
  level
)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Alice', 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', 0, 0, 0, 0, 0, 0, 0, 0, 1),
  ('10000000-0000-4000-8000-000000000002', 'Bob',   'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',   0, 0, 0, 0, 0, 0, 0, 0, 1),
  ('10000000-0000-4000-8000-000000000003', 'Chloé', 'https://api.dicebear.com/7.x/avataaars/svg?seed=chloe', 0, 0, 0, 0, 0, 0, 0, 0, 1),
  ('10000000-0000-4000-8000-000000000004', 'David', 'https://api.dicebear.com/7.x/avataaars/svg?seed=david', 0, 0, 0, 0, 0, 0, 0, 0, 1)
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url;

INSERT INTO public.auth_local_users (id, email, password_hash, email_verified)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'alice@yams.test', '$2a$10$BtmG03URLG/f7trOtzkD1ujwVRAbD.pKo454UKWmBDHZQTZVOHWfC', TRUE),
  ('10000000-0000-4000-8000-000000000002', 'bob@yams.test',   '$2a$10$BtmG03URLG/f7trOtzkD1ujwVRAbD.pKo454UKWmBDHZQTZVOHWfC', TRUE),
  ('10000000-0000-4000-8000-000000000003', 'chloe@yams.test', '$2a$10$BtmG03URLG/f7trOtzkD1ujwVRAbD.pKo454UKWmBDHZQTZVOHWfC', TRUE),
  ('10000000-0000-4000-8000-000000000004', 'david@yams.test', '$2a$10$BtmG03URLG/f7trOtzkD1ujwVRAbD.pKo454UKWmBDHZQTZVOHWfC', TRUE)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  email_verified = EXCLUDED.email_verified;
