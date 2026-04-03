-- Table d'authentification locale indépendante de Supabase Auth

create table if not exists public.auth_local_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Table pour les tokens de vérification d’email
create table if not exists public.email_verification_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_local_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '2 days'),
  used boolean not null default false
);

-- Table pour les tokens de réinitialisation de mot de passe
create table if not exists public.password_reset_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_local_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '1 day'),
  used boolean not null default false
);
