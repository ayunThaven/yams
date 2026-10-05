INSERT INTO public.games(id, owner, status)
VALUES ('GAMEC001', '00000000-0000-0000-0000-000000000003', 'in_progress');
CREATE TABLE public.v2_concurrent_before AS
SELECT id, parties_jouees, parties_gagnees, xp FROM public.users
WHERE id IN ('00000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-000000000003');
