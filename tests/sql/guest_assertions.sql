-- Run after the unchanged Phase 0 assertions, against the disposable fixture.
ALTER TABLE public.users ADD COLUMN username TEXT;
UPDATE public.users SET username = 'User-' || right(id::text, 1);

DO $$
DECLARE
  g1 UUID; g2 UUID; expired UUID; p1 UUID; p2 UUID; p3 UUID; p4 UUID;
  before_users JSONB; before_count INTEGER; payload JSONB; result JSONB;
BEGIN
  INSERT INTO public.guest_sessions(nickname, expires_at) VALUES ('Élodie', NOW() + interval '24 hours') RETURNING id INTO g1;
  INSERT INTO public.guest_sessions(nickname, expires_at) VALUES ('François', NOW() + interval '24 hours') RETURNING id INTO g2;
  INSERT INTO public.guest_sessions(nickname, created_at, expires_at) VALUES ('Expiré', NOW() - interval '2 days', NOW() - interval '1 day') RETURNING id INTO expired;
  INSERT INTO public.games(id, guest_owner_session_id) VALUES ('GUEST001', g1);
  INSERT INTO public.games(id, owner) VALUES ('USER0001', '00000000-0000-0000-0000-000000000001');

  p1 := public.join_casual_game('GUEST001', NULL, g1, 'spoofed name');
  p2 := public.join_casual_game('GUEST001', NULL, g2, 'spoofed name');
  p3 := public.join_casual_game('GUEST001', '00000000-0000-0000-0000-000000000001', NULL, 'spoofed name');
  p4 := public.join_casual_game('GUEST001', '00000000-0000-0000-0000-000000000002', NULL, 'spoofed name');
  PERFORM public.join_casual_game('USER0001', NULL, g1, 'spoofed');
  PERFORM public.join_casual_game('USER0001', '00000000-0000-0000-0000-000000000002', NULL, 'spoofed');
  IF p1 <> public.join_casual_game('GUEST001', NULL, g1, 'spoofed') THEN RAISE EXCEPTION 'duplicate guest'; END IF;
  IF (SELECT count(*) FROM public.game_players WHERE game_id = 'GUEST001') <> 4 THEN RAISE EXCEPTION 'mixed join'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_players WHERE id = p1 AND user_id IS NULL AND guest_session_id = g1 AND player_name = 'Élodie') THEN RAISE EXCEPTION 'canonical guest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_players WHERE id = p3 AND user_id IS NOT NULL AND guest_session_id IS NULL) THEN RAISE EXCEPTION 'canonical user'; END IF;

  BEGIN
    PERFORM public.join_casual_game('GUEST001', NULL, expired, 'Expired');
    RAISE EXCEPTION 'expired guest accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%guest session expired%' THEN RAISE; END IF;
  END;
  UPDATE public.games SET match_type = 'RANKED' WHERE id = 'USER0001';
  BEGIN
    PERFORM public.join_casual_game('USER0001', NULL, g2, 'Guest');
    RAISE EXCEPTION 'ranked guest accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%private Casual game required%' THEN RAISE; END IF;
  END;
  UPDATE public.games SET match_type = 'CASUAL' WHERE id = 'USER0001';

  PERFORM public.record_player_score_action_and_snapshot('GUEST001', p1, 'Élodie', 1, 'ones', ARRAY[1,1,2,3,4]::SMALLINT[], 2, 2, NULL::SMALLINT, '{}', 0);
  PERFORM public.record_player_score_action_and_snapshot('GUEST001', p3, 'User', 1, 'ones', ARRAY[1,1,2,3,4]::SMALLINT[], 2, 2, NULL::SMALLINT, '{}', 0);
  IF NOT EXISTS (SELECT 1 FROM public.game_score_actions WHERE game_player_id = p1 AND user_id IS NULL) THEN RAISE EXCEPTION 'guest score action'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_score_actions WHERE game_player_id = p3 AND user_id IS NOT NULL) THEN RAISE EXCEPTION 'user score action'; END IF;
  BEGIN
    PERFORM public.record_player_score_action_and_snapshot('USER0001', p1, 'Spoof', 1, 'ones', ARRAY[1,1,2,3,4]::SMALLINT[], 2, 2, NULL::SMALLINT, '{}', 0);
    RAISE EXCEPTION 'foreign participant accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%participant does not belong%' THEN RAISE; END IF;
  END;

  SELECT jsonb_agg(to_jsonb(u) ORDER BY id), count(*) INTO before_users, before_count FROM public.users u;
  payload := jsonb_build_array(
    jsonb_build_object('game_player_id', p1, 'player_name', 'Élodie', 'score', 150, 'won', TRUE, 'abandoned', FALSE),
    jsonb_build_object('game_player_id', p2, 'player_name', 'François', 'score', 40, 'won', FALSE, 'abandoned', TRUE),
    jsonb_build_object('game_player_id', p3, 'player_name', 'User1', 'score', 100, 'won', FALSE, 'abandoned', FALSE),
    jsonb_build_object('game_player_id', p4, 'player_name', 'User2', 'score', 90, 'won', FALSE, 'abandoned', FALSE)
  );
  result := public.finalize_game('GUEST001', payload);
  IF jsonb_array_length(result->'processed_user_ids') <> 2 THEN RAISE EXCEPTION 'guest applied to stats'; END IF;
  IF (SELECT count(*) FROM public.game_results WHERE game_id = 'GUEST001') <> 4 THEN RAISE EXCEPTION 'four results expected'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_results WHERE game_player_id IN (p1,p2) AND (user_id IS NOT NULL OR xp_gained <> 0)) THEN RAISE EXCEPTION 'guest XP'; END IF;
  IF (SELECT count(*) FROM public.users) <> before_count THEN RAISE EXCEPTION 'artificial user created'; END IF;
  SELECT jsonb_agg(to_jsonb(u) ORDER BY id) INTO before_users FROM public.users u;
  PERFORM public.finalize_game('GUEST001', payload);
  IF before_users IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.users u) THEN RAISE EXCEPTION 'repeated stats'; END IF;
  IF p1 <> public.join_casual_game('GUEST001', NULL, g1, 'Élodie') THEN RAISE EXCEPTION 'reconnection participant changed'; END IF;
  BEGIN
    PERFORM public.join_casual_game('GUEST001', NULL, expired, 'Expired');
    RAISE EXCEPTION 'expired reconnect accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%guest session expired%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.game_players', 'SELECT') OR has_table_privilege('authenticated', 'public.game_results', 'SELECT') THEN RAISE EXCEPTION 'guest history exposed to clients'; END IF;
  IF has_function_privilege('anon', 'public.join_casual_game(text,uuid,uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.record_player_game_result(text,uuid,text,integer,boolean,boolean,integer,smallint[],integer,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'client RPC access';
  END IF;
END $$;

-- Entirely guest-owned games never apply account stats, even for early abandons.
DO $$
DECLARE guest UUID; participant UUID; before_users JSONB;
BEGIN
  SELECT jsonb_agg(to_jsonb(u) ORDER BY id) INTO before_users FROM public.users u;
  INSERT INTO public.guest_sessions(nickname, expires_at) VALUES ('Invité seul', NOW() + interval '24 hours') RETURNING id INTO guest;
  INSERT INTO public.games(id, guest_owner_session_id) VALUES ('ONLYGST1', guest);
  participant := public.join_casual_game('ONLYGST1', NULL, guest, 'Invité seul');
  PERFORM public.record_player_game_result('ONLYGST1', participant, 'Invité seul', 30, FALSE, TRUE, 0, '{}'::SMALLINT[], 999, '{}', 'abandon');
  PERFORM public.finalize_game('ONLYGST1', jsonb_build_array(jsonb_build_object('game_player_id', participant, 'player_name', 'Invité seul', 'score', 30, 'won', FALSE, 'abandoned', TRUE)));
  IF (SELECT xp_gained FROM public.game_results WHERE game_player_id = participant) <> 0 THEN RAISE EXCEPTION 'guest early XP'; END IF;
  IF before_users IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.users u) THEN RAISE EXCEPTION 'guest mutated users'; END IF;
END $$;
SELECT 'Guest SQL assertions passed' AS result;
