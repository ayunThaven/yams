CREATE FUNCTION public.expect_sqlstate(p_sql TEXT, p_expected TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_failed BOOLEAN := FALSE;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> p_expected THEN RAISE; END IF;
    v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Expected SQLSTATE % for %', p_expected, p_sql; END IF;
END $$;

DO $$
DECLARE v_owner_fk RECORD; v_host_fk RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE visibility <> 'PRIVATE' OR match_type <> 'CASUAL') THEN
    RAISE EXCEPTION 'legacy visibility or match type changed';
  END IF;
  IF NOT (SELECT legacy_hostless FROM public.games WHERE id = 'FINISH01') THEN
    RAISE EXCEPTION 'finished ownerless game was not explicitly marked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE id IN ('FINISH02','GAMEA001') AND owner IS NULL) THEN
    RAISE EXCEPTION 'existing owner was lost';
  END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE id IN ('HOSTONLY','ACTIVEH1')
             AND (owner <> '00000000-0000-0000-0000-000000000003' OR legacy_hostless)) THEN
    RAISE EXCEPTION 'valid historical host_id was not normalized into owner';
  END IF;
  SELECT c.confrelid, c.confdeltype INTO v_owner_fk FROM pg_constraint c
    WHERE c.conrelid = 'public.games'::regclass AND c.conname = 'games_owner_users_fk';
  SELECT c.confrelid, c.confdeltype INTO v_host_fk FROM pg_constraint c
    WHERE c.conrelid = 'public.games'::regclass AND c.conname = 'games_host_users_fk';
  IF v_owner_fk.confrelid <> 'public.users'::regclass OR v_owner_fk.confdeltype <> 'r'
     OR v_host_fk.confrelid <> 'public.users'::regclass OR v_host_fk.confdeltype <> 'n' THEN
    RAISE EXCEPTION 'games foreign keys were not normalized';
  END IF;
  IF (SELECT count(*) FROM public.game_players WHERE game_id IN ('FINISH02','GAMEA001')) <> 2 THEN
    RAISE EXCEPTION 'historical result/action participants were not backfilled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_results r JOIN public.game_players p ON p.id = r.game_player_id
             WHERE r.game_id <> p.game_id OR r.user_id IS DISTINCT FROM p.user_id) THEN
    RAISE EXCEPTION 'result participant identity differs';
  END IF;
END $$;

SELECT public.expect_sqlstate(
  $$INSERT INTO public.games(id, status) VALUES ('NOHOST01','waiting')$$, '23514');
SELECT public.expect_sqlstate(
  $$INSERT INTO public.games(id, status, legacy_hostless) VALUES ('NEWFIN01','finished',TRUE)$$, 'P0001');
SELECT public.expect_sqlstate(
  $$UPDATE public.games SET legacy_hostless=TRUE, owner=NULL WHERE id='FINISH02'$$, 'P0001');
SELECT public.expect_sqlstate(
  $$DELETE FROM public.users WHERE id='00000000-0000-0000-0000-000000000001'$$, '23503');

INSERT INTO public.guest_sessions(id, nickname, expires_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'Visiteur', NOW() + INTERVAL '1 hour');
INSERT INTO public.games(id, status, guest_owner_session_id)
VALUES ('GUESTOWN', 'waiting', '10000000-0000-0000-0000-000000000001');
SELECT public.expect_sqlstate(
  $$INSERT INTO public.games(id, owner, guest_owner_session_id) VALUES
      ('BOTHHOST','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')$$,
  '23514');
SELECT public.expect_sqlstate(
  $$UPDATE public.guest_sessions SET expires_at=NOW()+INTERVAL '2 hours'
      WHERE id='10000000-0000-0000-0000-000000000001'$$, 'P0001');

INSERT INTO public.game_players(game_id, guest_session_id, player_name)
VALUES ('GAMEA001','10000000-0000-0000-0000-000000000001','Visiteur');
SELECT public.expect_sqlstate(
  $$INSERT INTO public.game_players(game_id, player_name) VALUES ('GAMEA001','Nobody')$$, '23514');
SELECT public.expect_sqlstate(
  $$INSERT INTO public.game_players(game_id,user_id,guest_session_id,player_name) VALUES
      ('GAMEA001','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Both')$$,
  '23514');

-- A direct writer cannot forge the compatibility mirror. Guest rows get NULL.
INSERT INTO public.game_results(game_id, game_player_id, user_id, player_name, score, won)
SELECT 'GAMEA001', id, '00000000-0000-0000-0000-000000000003', 'Visiteur', 0, FALSE
FROM public.game_players WHERE game_id='GAMEA001' AND guest_session_id='10000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT user_id FROM public.game_results WHERE game_id='GAMEA001' AND player_name='Visiteur') IS NOT NULL THEN
    RAISE EXCEPTION 'guest result retained a user_id';
  END IF;
END $$;
INSERT INTO public.game_score_actions(
  game_id, game_player_id, user_id, player_name, turn_number, category,
  dice_values, score, total_after
) SELECT 'GAMEA001', id, '00000000-0000-0000-0000-000000000003',
  'Visiteur', 1, 'ones', ARRAY[1,1,1,2,3]::SMALLINT[], 3, 3
FROM public.game_players WHERE game_id='GAMEA001' AND guest_session_id='10000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT user_id FROM public.game_score_actions WHERE game_id='GAMEA001' AND player_name='Visiteur') IS NOT NULL THEN
    RAISE EXCEPTION 'guest action retained a user_id';
  END IF;
END $$;
SELECT public.expect_sqlstate(
  $$INSERT INTO public.game_results(game_id, game_player_id, player_name, score, won)
      SELECT 'GUESTOWN', id, 'Wrong game', 0, FALSE FROM public.game_players
      WHERE game_id='GAMEA001' AND guest_session_id='10000000-0000-0000-0000-000000000001'$$,
  'P0001');
SELECT public.expect_sqlstate(
  $$INSERT INTO public.game_score_actions(game_id, game_player_id, player_name, turn_number, category, dice_values, score, total_after)
      SELECT 'GUESTOWN', id, 'Wrong game', 1, 'ones', ARRAY[1,1,1,1,1]::SMALLINT[], 5, 5
      FROM public.game_players WHERE game_id='GAMEA001' AND guest_session_id='10000000-0000-0000-0000-000000000001'$$,
  'P0001');

-- One authenticated player already has an action, but no result yet.
SELECT public.finalize_game('GAMEA001',
  '[{"user_id":"00000000-0000-0000-0000-000000000001","player_name":"Alice","score":100,"won":true,"abandoned":false,"yams_count":0,"yams_faces":[],"score_sheet":{},"reason":"completed"},
    {"user_id":"00000000-0000-0000-0000-000000000002","player_name":"Brian","score":90,"won":false,"abandoned":false,"yams_count":0,"yams_faces":[],"score_sheet":{},"reason":"completed"}]'::jsonb);
SELECT public.finalize_game('GAMEA001',
  '[{"user_id":"00000000-0000-0000-0000-000000000001","player_name":"Alice","score":100,"won":true,"abandoned":false,"yams_count":0,"yams_faces":[],"score_sheet":{},"reason":"completed"},
    {"user_id":"00000000-0000-0000-0000-000000000002","player_name":"Brian","score":90,"won":false,"abandoned":false,"yams_count":0,"yams_faces":[],"score_sheet":{},"reason":"completed"}]'::jsonb);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.game_results WHERE game_id='GAMEA001') <> 3
     OR (SELECT parties_jouees FROM public.users WHERE id='00000000-0000-0000-0000-000000000001') <> 1
     OR (SELECT parties_gagnees FROM public.users WHERE id='00000000-0000-0000-0000-000000000001') <> 1
     OR (SELECT xp FROM public.users WHERE id='00000000-0000-0000-0000-000000000001') <> 35
     OR (SELECT parties_jouees FROM public.users WHERE id='00000000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'finalization applied a persistent effect twice';
  END IF;
END $$;

-- A finished status is not a gate for a result missing from an earlier run.
SELECT public.finalize_game('GAMEA002',
  '[{"user_id":"00000000-0000-0000-0000-000000000001","player_name":"Alice","score":50,"won":true,"abandoned":false,"yams_count":0,"yams_faces":[],"score_sheet":{},"reason":"completed"}]'::jsonb);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.game_results WHERE game_id='GAMEA002') <> 1
     OR (SELECT parties_jouees FROM public.users WHERE id='00000000-0000-0000-0000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'finished status blocked recovery';
  END IF;
END $$;

INSERT INTO public.user_ratings(user_id,mu,sigma)
VALUES ('00000000-0000-0000-0000-000000000001',25,8.333333);
SELECT public.expect_sqlstate(
  $$INSERT INTO public.user_ratings(user_id,mu,sigma)
      VALUES ('10000000-0000-0000-0000-000000000001',25,8)$$, '23503');
INSERT INTO public.rating_history(
  game_id,user_id,position,player_count,mu_before,sigma_before,mu_after,sigma_after
) VALUES ('GAMEA001','00000000-0000-0000-0000-000000000001',1,2,25,8,27,7);
SELECT public.expect_sqlstate(
  $$INSERT INTO public.rating_history(game_id,user_id,position,player_count,mu_before,sigma_before,mu_after,sigma_after)
      VALUES ('GAMEA001','00000000-0000-0000-0000-000000000001',1,2,25,8,27,7)$$, '23505');

SELECT 'V2 SQL assertions passed' AS result;
