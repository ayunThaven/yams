DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_results WHERE game_id='GAMEC001') <> 2 THEN
    RAISE EXCEPTION 'concurrent finalization did not persist exactly two results';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users u JOIN public.v2_concurrent_before b USING (id)
    WHERE u.parties_jouees <> b.parties_jouees + 1
      OR u.parties_gagnees <> b.parties_gagnees
        + CASE WHEN u.id='00000000-0000-0000-0000-000000000003' THEN 1 ELSE 0 END
      OR u.xp <> b.xp
        + CASE WHEN u.id='00000000-0000-0000-0000-000000000003' THEN 31 ELSE 5 END
  ) THEN
    RAISE EXCEPTION 'concurrent finalization duplicated statistics or XP';
  END IF;
END $$;
SELECT 'Concurrent V2 finalization passed' AS result;
