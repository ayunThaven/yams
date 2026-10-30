CREATE OR REPLACE FUNCTION public.join_casual_game(p_game_id TEXT, p_user_id UUID, p_guest_session_id UUID, p_player_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_game public.games; v_id UUID; v_name TEXT;
BEGIN
  IF num_nonnulls(p_user_id, p_guest_session_id) <> 1 THEN RAISE EXCEPTION 'exactly one identity required'; END IF;
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_game.match_type <> 'CASUAL' THEN
    RAISE EXCEPTION 'Casual game required';
  END IF;
  IF p_guest_session_id IS NOT NULL THEN
    SELECT nickname INTO v_name FROM public.guest_sessions WHERE id = p_guest_session_id AND expires_at > NOW();
    IF NOT FOUND THEN RAISE EXCEPTION 'guest session expired'; END IF;
    UPDATE public.guest_sessions SET last_active_at = NOW() WHERE id = p_guest_session_id;
  ELSE
    SELECT username INTO v_name FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'user missing'; END IF;
  END IF;
  SELECT id INTO v_id FROM public.game_players WHERE game_id = p_game_id
    AND (user_id = p_user_id OR guest_session_id = p_guest_session_id);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF v_game.status <> 'waiting' THEN RAISE EXCEPTION 'not a participant of this game'; END IF;
  INSERT INTO public.game_players(game_id, user_id, guest_session_id, player_name)
  VALUES(p_game_id, p_user_id, p_guest_session_id, v_name) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_casual_game(TEXT,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_casual_game(TEXT,UUID,UUID,TEXT) TO service_role;
