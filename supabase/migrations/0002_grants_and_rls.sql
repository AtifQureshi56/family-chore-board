-- Grants and row-level security.
--
-- The app talks to Postgres in exactly two ways:
--   * server side, with the secret key (service_role) - every read and every write
--   * browser side, with the publishable key (anon)   - ONLY the TV board's realtime
--     subscription, which needs to know that `completions` changed so it can ask the
--     server for fresh data. It never reads the row contents.
--
-- So: service_role gets everything, anon gets read-only access to completions and
-- nothing else. RLS is on everywhere; service_role bypasses it, anon does not.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Anything added later inherits the same shape.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

-- ------------------------------------------------------------------ diagnostics
-- Reports which database role an API key actually maps to. Used once during setup
-- to confirm the secret key is service_role; safe to drop afterwards.
create or replace function public.whoami()
returns text
language sql
stable
security invoker
as $$ select current_user::text $$;

grant execute on function public.whoami() to anon, authenticated, service_role;

-- ------------------------------------------------------------------------- RLS
alter table children     enable row level security;
alter table tasks        enable row level security;
alter table completions  enable row level security;
alter table perfect_days enable row level security;
alter table settings     enable row level security;

-- The TV board's realtime subscription. Realtime enforces RLS, so without this the
-- board would never receive a change event. Read-only, and completions rows carry
-- no sensitive data - just a child id, a task id and a number.
grant select on completions to anon;

drop policy if exists "anon reads completions for the tv board" on completions;
create policy "anon reads completions for the tv board"
  on completions for select
  to anon
  using (true);

-- No policies for anon on children, tasks, perfect_days or settings. settings holds
-- the parent PIN hash and must never be reachable from a browser.
