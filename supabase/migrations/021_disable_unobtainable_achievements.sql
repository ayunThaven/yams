-- Do not display achievements for features that are not implemented yet.
-- bug_finder intentionally remains active and is the only manually awarded achievement.
UPDATE public.achievements
SET is_active = FALSE
WHERE id IN ('all_in_one', 'win_all_in_one', 'friend_1');
