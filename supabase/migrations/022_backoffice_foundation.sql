-- Back-office, bug tickets and authoritative score evidence.
-- Incremental and idempotent: migrations 017-021 are already deployed.

CREATE TABLE IF NOT EXISTS public.backoffice_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  totp_secret_encrypted TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version > 0),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backoffice_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES public.backoffice_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backoffice_access_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.backoffice_users(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.backoffice_invitations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.backoffice_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR invitation_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.backoffice_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.backoffice_users(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.backoffice_invitations(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backoffice_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.backoffice_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code_hash)
);

CREATE OR REPLACE FUNCTION public.consume_backoffice_access_link(
  p_link_hash TEXT,
  p_device_hash TEXT,
  p_label TEXT,
  p_device_expires_at TIMESTAMPTZ
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_link public.backoffice_access_links%ROWTYPE;
  v_device_id UUID;
BEGIN
  SELECT * INTO v_link
  FROM public.backoffice_access_links
  WHERE token_hash = p_link_hash
  FOR UPDATE;

  IF NOT FOUND OR v_link.used_at IS NOT NULL OR v_link.expires_at <= NOW() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.backoffice_devices(user_id, invitation_id, token_hash, label, expires_at)
  VALUES (v_link.user_id, v_link.invitation_id, p_device_hash, left(COALESCE(p_label, 'Appareil'), 250), p_device_expires_at)
  RETURNING id INTO v_device_id;

  UPDATE public.backoffice_access_links SET used_at = NOW() WHERE id = v_link.id;
  RETURN jsonb_build_object(
    'device_id', v_device_id,
    'user_id', v_link.user_id,
    'invitation_id', v_link.invitation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_backoffice_recovery_code(
  p_user_id UUID,
  p_code_hash TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_code_id UUID;
BEGIN
  UPDATE public.backoffice_recovery_codes
  SET used_at = NOW()
  WHERE user_id = p_user_id AND code_hash = p_code_hash AND used_at IS NULL
  RETURNING id INTO v_code_id;
  RETURN v_code_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_backoffice_activation(
  p_user_id UUID,
  p_invitation_id UUID,
  p_recovery_hashes TEXT[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_invitation public.backoffice_invitations%ROWTYPE;
  v_user public.backoffice_users%ROWTYPE;
BEGIN
  IF cardinality(p_recovery_hashes) <> 8 THEN RAISE EXCEPTION 'invalid recovery codes'; END IF;

  SELECT * INTO v_invitation
  FROM public.backoffice_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;
  IF NOT FOUND OR v_invitation.used_at IS NOT NULL OR v_invitation.expires_at <= NOW() THEN RETURN NULL; END IF;

  SELECT * INTO v_user
  FROM public.backoffice_users
  WHERE id = p_user_id AND lower(email) = lower(v_invitation.email) AND totp_enabled = FALSE
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.backoffice_recovery_codes(user_id, code_hash)
  SELECT p_user_id, code_hash FROM unnest(p_recovery_hashes) AS code_hash;
  UPDATE public.backoffice_users SET totp_enabled = TRUE WHERE id = p_user_id;
  UPDATE public.backoffice_invitations SET used_at = NOW() WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'role', v_user.role,
    'session_version', v_user.session_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_backoffice_access_link(TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_backoffice_recovery_code(UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_backoffice_activation(UUID,UUID,TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_backoffice_access_link(TEXT,TEXT,TEXT,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_backoffice_recovery_code(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_backoffice_activation(UUID,UUID,TEXT[]) TO service_role;

CREATE TABLE IF NOT EXISTS public.backoffice_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.backoffice_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.prevent_backoffice_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'backoffice audit logs are append-only';
END;
$$;

DROP TRIGGER IF EXISTS backoffice_audit_immutable ON public.backoffice_audit_logs;
CREATE TRIGGER backoffice_audit_immutable
  BEFORE UPDATE OR DELETE ON public.backoffice_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_backoffice_audit_mutation();

CREATE TABLE IF NOT EXISTS public.bug_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES public.games(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 10000),
  reproduction_steps TEXT NOT NULL DEFAULT '',
  expected_behavior TEXT NOT NULL DEFAULT '',
  actual_behavior TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'in_progress', 'resolved', 'rejected')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  assigned_to UUID REFERENCES public.backoffice_users(id) ON DELETE SET NULL,
  internal_notes TEXT,
  public_resolution TEXT,
  client_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bug_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.bug_tickets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id)
);

CREATE TABLE IF NOT EXISTS public.game_score_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  turn_number INTEGER NOT NULL CHECK (turn_number BETWEEN 1 AND 13),
  category TEXT NOT NULL,
  dice_values SMALLINT[] NOT NULL CHECK (
    array_length(dice_values, 1) = 5
    AND dice_values <@ ARRAY[1,2,3,4,5,6]::SMALLINT[]
  ),
  score INTEGER NOT NULL CHECK (score >= 0),
  total_after INTEGER NOT NULL CHECK (total_after >= 0),
  yams_face SMALLINT CHECK (yams_face BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_backoffice_devices_token ON public.backoffice_devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_backoffice_audit_target ON public.backoffice_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_tickets_reporter ON public.bug_tickets(reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_tickets_status ON public.bug_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_score_actions_game ON public.game_score_actions(game_id, created_at);
CREATE INDEX IF NOT EXISTS idx_game_score_actions_user ON public.game_score_actions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_score_action_and_snapshot(
  p_game_id TEXT,
  p_user_id UUID,
  p_player_name TEXT,
  p_turn_number INTEGER,
  p_category TEXT,
  p_dice_values SMALLINT[],
  p_score INTEGER,
  p_total_after INTEGER,
  p_yams_face SMALLINT,
  p_state JSONB,
  p_expected_version INTEGER,
  p_turn_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_version INTEGER;
BEGIN
  INSERT INTO public.game_score_actions(game_id,user_id,player_name,turn_number,category,dice_values,score,total_after,yams_face)
  VALUES (p_game_id,p_user_id,p_player_name,p_turn_number,p_category,p_dice_values,p_score,p_total_after,p_yams_face)
  ON CONFLICT (game_id,user_id,category) DO NOTHING;

  SELECT public.save_game_snapshot(p_game_id,p_state,p_expected_version,p_turn_expires_at) INTO v_version;
  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.record_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_score_action_and_snapshot(TEXT,UUID,TEXT,INTEGER,TEXT,SMALLINT[],INTEGER,INTEGER,SMALLINT,JSONB,INTEGER,TIMESTAMPTZ) TO service_role;

DROP TRIGGER IF EXISTS set_backoffice_users_updated_at ON public.backoffice_users;
CREATE TRIGGER set_backoffice_users_updated_at BEFORE UPDATE ON public.backoffice_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_bug_tickets_updated_at ON public.bug_tickets;
CREATE TRIGGER set_bug_tickets_updated_at BEFORE UPDATE ON public.bug_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.game_results ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.game_results ADD COLUMN IF NOT EXISTS yams_faces SMALLINT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_results_reason_check') THEN
    ALTER TABLE public.game_results ADD CONSTRAINT game_results_reason_check
      CHECK (reason IN ('completed', 'abandon', 'timeout', 'server_interrupted')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_canonical_game_result(
  p_game_id TEXT,
  p_user_id UUID,
  p_player_name TEXT,
  p_score INTEGER,
  p_won BOOLEAN,
  p_abandoned BOOLEAN,
  p_yams_count INTEGER,
  p_yams_faces SMALLINT[],
  p_xp_gained INTEGER,
  p_score_sheet JSONB,
  p_reason TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted UUID;
BEGIN
  INSERT INTO public.game_results(game_id,user_id,player_name,score,won,abandoned,yams_count,yams_faces,xp_gained,score_sheet,reason)
  VALUES (p_game_id,p_user_id,p_player_name,p_score,p_won,p_abandoned,p_yams_count,COALESCE(p_yams_faces,'{}'),p_xp_gained,COALESCE(p_score_sheet,'{}'),p_reason)
  ON CONFLICT (game_id,user_id) DO NOTHING RETURNING user_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN FALSE; END IF;
  PERFORM public.update_user_stats(p_user_id,p_score,p_won,p_abandoned,p_yams_count,p_xp_gained);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_canonical_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_canonical_game_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,SMALLINT[],INTEGER,JSONB,TEXT) TO service_role;

-- Compatibility shim: callers of the deprecated RPC now write to the
-- canonical table. No new row is ever added to game_player_results.
CREATE OR REPLACE FUNCTION public.record_game_player_result(
  p_game_id TEXT,
  p_user_id UUID,
  p_player_name TEXT,
  p_score INTEGER,
  p_won BOOLEAN,
  p_abandoned BOOLEAN DEFAULT FALSE,
  p_yams_count INTEGER DEFAULT 0,
  p_xp_gained INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT 'completed'
)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.record_canonical_game_result(
    p_game_id, p_user_id, p_player_name, p_score, p_won, p_abandoned,
    p_yams_count, '{}'::SMALLINT[], p_xp_gained, '{}'::JSONB, p_reason
  );
$$;

REVOKE ALL ON FUNCTION public.record_game_player_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,INTEGER,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_player_result(TEXT,UUID,TEXT,INTEGER,BOOLEAN,BOOLEAN,INTEGER,INTEGER,TEXT) TO service_role;

DO $$
BEGIN
  IF to_regclass('public.game_player_results') IS NOT NULL THEN
    INSERT INTO public.game_results (
      game_id, user_id, player_name, score, won, abandoned, yams_count,
      xp_gained, score_sheet, reason, finalized_at
    )
    SELECT game_id, user_id, player_name, score, won, abandoned, yams_count,
      xp_gained, '{}'::jsonb, reason, created_at
    FROM public.game_player_results
    ON CONFLICT (game_id, user_id) DO UPDATE SET
      reason = EXCLUDED.reason,
      finalized_at = LEAST(public.game_results.finalized_at, EXCLUDED.finalized_at);
  END IF;
END $$;

ALTER TABLE public.game_results VALIDATE CONSTRAINT game_results_reason_check;

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO public.achievements (id, name, description, image_path, rarity, category, is_active)
VALUES (
  'bug_finder', 'Bug Finder', 'Signaler un bug confirmé et corrigé.',
  '/images/achievements/Crystal/SMedals_BugFinder_Text.webp', 'Crystal', 'special', TRUE
)
ON CONFLICT (id) DO UPDATE SET
  is_active = TRUE,
  image_path = EXCLUDED.image_path;

CREATE OR REPLACE FUNCTION public.backoffice_update_player_stats(
  p_actor_id UUID,
  p_user_id UUID,
  p_values JSONB,
  p_reason TEXT,
  p_ticket_id UUID DEFAULT NULL,
  p_game_id TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before public.users%ROWTYPE;
  v_after public.users%ROWTYPE;
  v_played INTEGER;
  v_won INTEGER;
  v_abandoned INTEGER;
  v_best_streak INTEGER;
  v_current_streak INTEGER;
  v_xp INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.backoffice_users WHERE id = p_actor_id AND disabled_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;

  SELECT * INTO v_before FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  IF p_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bug_tickets WHERE id = p_ticket_id AND reporter_user_id = p_user_id
  ) THEN RAISE EXCEPTION 'ticket does not belong to user'; END IF;
  IF p_game_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_results WHERE game_id = p_game_id AND user_id = p_user_id
  ) THEN RAISE EXCEPTION 'game does not belong to user'; END IF;

  v_played := COALESCE((p_values->>'parties_jouees')::INTEGER, v_before.parties_jouees);
  v_won := COALESCE((p_values->>'parties_gagnees')::INTEGER, v_before.parties_gagnees);
  v_abandoned := COALESCE((p_values->>'parties_abandonnees')::INTEGER, v_before.parties_abandonnees);
  v_best_streak := COALESCE((p_values->>'meilleure_serie_victoires')::INTEGER, v_before.meilleure_serie_victoires);
  v_current_streak := COALESCE((p_values->>'serie_victoires_actuelle')::INTEGER, v_before.serie_victoires_actuelle);
  v_xp := COALESCE((p_values->>'xp')::INTEGER, v_before.xp);

  IF v_played < 0 OR v_won < 0 OR v_abandoned < 0 OR v_best_streak < 0 OR v_current_streak < 0 OR v_xp < 0
     OR v_won > v_played OR v_abandoned > v_played OR v_current_streak > v_best_streak OR v_best_streak > v_won THEN
    RAISE EXCEPTION 'inconsistent statistics';
  END IF;

  UPDATE public.users SET
    parties_jouees = v_played,
    parties_gagnees = v_won,
    parties_abandonnees = v_abandoned,
    meilleur_score = COALESCE((p_values->>'meilleur_score')::INTEGER, meilleur_score),
    nombre_yams_realises = COALESCE((p_values->>'nombre_yams_realises')::INTEGER, nombre_yams_realises),
    meilleure_serie_victoires = v_best_streak,
    serie_victoires_actuelle = v_current_streak,
    xp = v_xp,
    level = public.level_from_xp(v_xp)
  WHERE id = p_user_id RETURNING * INTO v_after;

  IF v_after.meilleur_score < 0 OR v_after.nombre_yams_realises < 0 THEN RAISE EXCEPTION 'negative statistics'; END IF;

  INSERT INTO public.backoffice_audit_logs(actor_id, action, target_type, target_id, reason, before_data, after_data, metadata)
  VALUES (p_actor_id, 'player.stats.updated', 'user', p_user_id::TEXT, trim(p_reason), to_jsonb(v_before), to_jsonb(v_after),
    jsonb_build_object('ticket_id', p_ticket_id, 'game_id', p_game_id));
  RETURN to_jsonb(v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.backoffice_grant_achievement(
  p_actor_id UUID,
  p_user_id UUID,
  p_achievement_id TEXT,
  p_reason TEXT,
  p_ticket_id UUID DEFAULT NULL,
  p_game_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inserted UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.backoffice_users WHERE id = p_actor_id AND disabled_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  IF p_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bug_tickets WHERE id = p_ticket_id AND reporter_user_id = p_user_id
  ) THEN RAISE EXCEPTION 'ticket does not belong to user'; END IF;
  IF p_game_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_results WHERE game_id = p_game_id AND user_id = p_user_id
  ) THEN RAISE EXCEPTION 'game does not belong to user'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE id = p_achievement_id AND is_active) THEN RAISE EXCEPTION 'inactive achievement'; END IF;
  INSERT INTO public.user_achievements(user_id, achievement_id) VALUES (p_user_id, p_achievement_id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING id INTO v_inserted;
  INSERT INTO public.backoffice_audit_logs(actor_id, action, target_type, target_id, reason, after_data, metadata)
  VALUES (p_actor_id, 'player.achievement.granted', 'user', p_user_id::TEXT, trim(p_reason),
    jsonb_build_object('achievement_id', p_achievement_id, 'inserted', v_inserted IS NOT NULL),
    jsonb_build_object('ticket_id', p_ticket_id, 'game_id', p_game_id));
  RETURN v_inserted IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.backoffice_resolve_ticket_with_reward(
  p_actor_id UUID,
  p_ticket_id UUID,
  p_resolution TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ticket public.bug_tickets%ROWTYPE; v_inserted UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.backoffice_users WHERE id = p_actor_id AND disabled_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(COALESCE(p_resolution, ''))) < 3 THEN RAISE EXCEPTION 'resolution required'; END IF;
  SELECT * INTO v_ticket FROM public.bug_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_ticket.status NOT IN ('confirmed', 'in_progress', 'resolved') THEN RAISE EXCEPTION 'ticket must be confirmed'; END IF;
  INSERT INTO public.user_achievements(user_id, achievement_id) VALUES (v_ticket.reporter_user_id, 'bug_finder')
    ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING id INTO v_inserted;
  UPDATE public.bug_tickets SET status = 'resolved', public_resolution = trim(p_resolution), resolved_at = COALESCE(resolved_at, NOW())
    WHERE id = p_ticket_id;
  INSERT INTO public.backoffice_audit_logs(actor_id, action, target_type, target_id, reason, before_data, after_data)
  VALUES (p_actor_id, 'ticket.resolved_with_reward', 'ticket', p_ticket_id::TEXT, trim(p_resolution), to_jsonb(v_ticket),
    jsonb_build_object('status', 'resolved', 'bug_finder_inserted', v_inserted IS NOT NULL));
  RETURN jsonb_build_object('resolved', TRUE, 'achievement_granted', v_inserted IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.backoffice_update_player_stats(UUID, UUID, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backoffice_grant_achievement(UUID, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backoffice_resolve_ticket_with_reward(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backoffice_update_player_stats(UUID, UUID, JSONB, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.backoffice_grant_achievement(UUID, UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.backoffice_resolve_ticket_with_reward(UUID, UUID, TEXT) TO service_role;

ALTER TABLE public.backoffice_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_score_actions ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-report-attachments', 'bug-report-attachments', FALSE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = FALSE, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];
