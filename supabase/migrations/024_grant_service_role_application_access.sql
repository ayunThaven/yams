-- Restore the database privileges required by the server-only Supabase client.
-- service_role bypasses RLS but still needs PostgreSQL grants when the migration
-- owner did not configure default privileges for that role.
-- No permission is granted here to anon or authenticated.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Some older deployments do not contain every historical table/function.
-- Grant each object independently so this repair migration remains idempotent.
DO $$
DECLARE
  v_relation TEXT;
  v_function TEXT;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'users', 'auth_local_users', 'email_verification_tokens',
    'password_reset_tokens', 'games', 'game_players', 'game_results',
    'game_player_results', 'game_snapshots', 'achievements',
    'user_achievements', 'backoffice_users', 'backoffice_invitations',
    'backoffice_access_links', 'backoffice_devices',
    'backoffice_recovery_codes', 'backoffice_audit_logs', 'bug_tickets',
    'bug_ticket_attachments', 'game_score_actions'
  ] LOOP
    IF to_regclass(format('public.%I', v_relation)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', v_relation);
    END IF;
  END LOOP;

  FOREACH v_relation IN ARRAY ARRAY['leaderboard', 'achievements_with_rarity_rank'] LOOP
    IF to_regclass(format('public.%I', v_relation)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', v_relation);
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'public.consume_auth_rate_limit(text,integer,integer)',
    'public.finalize_game(text,jsonb)',
    'public.save_game_snapshot(text,jsonb,integer,timestamp with time zone)',
    'public.unlock_achievement(uuid,text)',
    'public.record_score_action_and_snapshot(text,uuid,text,integer,text,smallint[],integer,integer,smallint,jsonb,integer,timestamp with time zone)',
    'public.record_canonical_game_result(text,uuid,text,integer,boolean,boolean,integer,smallint[],integer,jsonb,text)',
    'public.record_game_player_result(text,uuid,text,integer,boolean,boolean,integer,integer,text)',
    'public.consume_backoffice_access_link(text,text,text,timestamp with time zone)',
    'public.consume_backoffice_recovery_code(uuid,text)',
    'public.complete_backoffice_activation(uuid,uuid,text[])',
    'public.backoffice_update_player_stats(uuid,uuid,jsonb,text,uuid,text)',
    'public.backoffice_grant_achievement(uuid,uuid,text,text,uuid,text)',
    'public.backoffice_resolve_ticket_with_reward(uuid,uuid,text)'
  ] LOOP
    IF to_regprocedure(v_function) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
    END IF;
  END LOOP;

  -- The private screenshot bucket is only used from server routes.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    GRANT USAGE ON SCHEMA storage TO service_role;
    FOREACH v_relation IN ARRAY ARRAY['buckets', 'objects'] LOOP
      IF to_regclass(format('storage.%I', v_relation)) IS NOT NULL THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.%I TO service_role', v_relation);
      END IF;
    END LOOP;
  END IF;

  FOREACH v_relation IN ARRAY ARRAY[
    'backoffice_users', 'backoffice_invitations', 'backoffice_access_links',
    'backoffice_devices', 'backoffice_recovery_codes', 'backoffice_audit_logs',
    'bug_tickets', 'bug_ticket_attachments', 'game_score_actions'
  ] LOOP
    IF to_regclass(format('public.%I', v_relation)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_relation);
    END IF;
  END LOOP;
END $$;
