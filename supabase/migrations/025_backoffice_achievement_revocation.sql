-- Explicit achievement revocation for back-office operators.
-- The user-achievement row is removed so the player immediately loses access;
-- the immutable audit row preserves the reason and the former unlock state.

CREATE OR REPLACE FUNCTION public.backoffice_revoke_achievement(
  p_actor_id UUID,
  p_user_id UUID,
  p_achievement_id TEXT,
  p_reason TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_achievement public.user_achievements%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.backoffice_users WHERE id = p_actor_id AND disabled_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT * INTO v_achievement
  FROM public.user_achievements
  WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.user_achievements WHERE id = v_achievement.id;
  INSERT INTO public.backoffice_audit_logs(actor_id, action, target_type, target_id, reason, before_data, metadata)
  VALUES (
    p_actor_id,
    'player.achievement.revoked',
    'user',
    p_user_id::TEXT,
    trim(p_reason),
    jsonb_build_object('achievement_id', p_achievement_id, 'unlocked_at', v_achievement.unlocked_at),
    jsonb_build_object('achievement_id', p_achievement_id)
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.backoffice_revoke_achievement(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backoffice_revoke_achievement(UUID, UUID, TEXT, TEXT) TO service_role;
