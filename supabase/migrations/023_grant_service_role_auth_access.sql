-- The application performs local authentication exclusively through the
-- server-side Supabase client, authenticated as service_role.  A service-role
-- JWT bypasses RLS but it does not bypass PostgreSQL table privileges.
--
-- Explicit grants are required because these tables may have been created by a
-- migration owner whose default privileges do not include service_role.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_local_users
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_verification_tokens
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.password_reset_tokens
  TO service_role;

