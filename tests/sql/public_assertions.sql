DO $$
DECLARE guest UUID; user_player UUID; guest_player UUID;
BEGIN
  INSERT INTO public.guest_sessions(nickname, expires_at) VALUES ('Public guest', NOW() + interval '1 hour') RETURNING id INTO guest;
  INSERT INTO public.games(id, owner, visibility, match_type) VALUES ('PUBLIC01', '00000000-0000-0000-0000-000000000001', 'PUBLIC', 'CASUAL');
  user_player := public.join_casual_game('PUBLIC01', '00000000-0000-0000-0000-000000000001', NULL, 'spoof');
  guest_player := public.join_casual_game('PUBLIC01', NULL, guest, 'spoof');
  IF user_player IS NULL OR guest_player IS NULL OR user_player = guest_player THEN RAISE EXCEPTION 'public participants missing'; END IF;
  UPDATE public.games SET match_type = 'RANKED' WHERE id = 'PUBLIC01';
  BEGIN
    PERFORM public.join_casual_game('PUBLIC01', NULL, guest, 'spoof');
    RAISE EXCEPTION 'ranked accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Casual game required%' THEN RAISE; END IF;
  END;
END $$;
