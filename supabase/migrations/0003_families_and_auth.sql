  -- Families: the tenant boundary.
--
-- Before this migration the whole database WAS one family. Every table is now
-- scoped by family_id, and a parent reaches their family by signing in with
-- Google. Nothing in the app may ever read a row without a family_id filter -
-- that filter is the entire privacy story for other people's children.
--
-- Existing data is not thrown away. It is gathered into a single family marked
-- `claimable`, and the first Google account to sign in adopts it. That is how
-- the original board survives the move to multi-tenant without an export.

-- ------------------------------------------------------------------- tenants
create table if not exists families (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null default 'My family',
  -- True for exactly one family at most: the pre-auth board, waiting for its
  -- owner to sign in for the first time. Cleared the moment it is adopted.
  claimable  boolean     not null default false,
  created_at timestamptz not null default now()
);

-- One row per signed-in parent. A user belongs to exactly one family, which is
-- why user_id is the primary key rather than a surrogate.
create table if not exists family_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  family_id  uuid not null references families(id) on delete cascade,
  email      text,
  role       text not null default 'parent' check (role in ('parent')),
  created_at timestamptz not null default now()
);

create index if not exists family_members_family_idx on family_members (family_id);

-- ------------------------------------------------------------ scope the data
alter table children     add column if not exists family_id uuid references families(id) on delete cascade;
alter table tasks        add column if not exists family_id uuid references families(id) on delete cascade;
alter table completions  add column if not exists family_id uuid references families(id) on delete cascade;
alter table perfect_days add column if not exists family_id uuid references families(id) on delete cascade;
alter table settings     add column if not exists family_id uuid references families(id) on delete cascade;

-- ---------------------------------------------------------------- backfill
-- Everything that predates this migration belongs to one family, and that
-- family is up for adoption by whoever signs in first.
do $$
declare legacy uuid;
begin
  if exists (select 1 from children     where family_id is null)
  or exists (select 1 from tasks        where family_id is null)
  or exists (select 1 from completions  where family_id is null)
  or exists (select 1 from perfect_days where family_id is null)
  or exists (select 1 from settings     where family_id is null)
  then
    insert into families (name, claimable) values ('My family', true) returning id into legacy;

    update children     set family_id = legacy where family_id is null;
    update tasks        set family_id = legacy where family_id is null;
    update completions  set family_id = legacy where family_id is null;
    update perfect_days set family_id = legacy where family_id is null;
    update settings     set family_id = legacy where family_id is null;
  end if;
end $$;

alter table children     alter column family_id set not null;
alter table tasks        alter column family_id set not null;
alter table completions  alter column family_id set not null;
alter table perfect_days alter column family_id set not null;
alter table settings     alter column family_id set not null;

-- The PIN is per family now, so `key` alone can no longer be the identity.
alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (family_id, key);

-- Every hot query filters by family first; the old indexes led with the wrong
-- column and would have scanned across tenants.
create index if not exists children_family_idx     on children     (family_id, is_active, sort_order);
create index if not exists tasks_family_idx        on tasks        (family_id, is_active, child_id, on_date);
create index if not exists completions_family_idx  on completions  (family_id, completed_on);
create index if not exists perfect_days_family_idx on perfect_days (family_id, on_date);

-- ---------------------------------------------------------------------- RLS
alter table families       enable row level security;
alter table family_members enable row level security;

-- Which family the caller belongs to. security definer so that a policy using it
-- does not itself have to get through family_members' policy - that recursion is
-- the classic way multi-tenant RLS ends up either broken or wide open.
create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select family_id from family_members where user_id = auth.uid() limit 1 $$;

grant execute on function public.my_family_id() to authenticated, service_role;

-- The TV board's realtime feed used to run as `anon` and could see every row in
-- `completions`. With more than one family in the database that is a leak, so the
-- feed now runs as the signed-in parent and sees only their own family.
drop policy if exists "anon reads completions for the tv board" on completions;
revoke select on completions from anon;

grant select on completions    to authenticated;
grant select on family_members to authenticated;
grant select on families       to authenticated;

drop policy if exists "members read their own completions" on completions;
create policy "members read their own completions"
  on completions for select
  to authenticated
  using (family_id = public.my_family_id());

drop policy if exists "read own membership" on family_members;
create policy "read own membership"
  on family_members for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "read own family" on families;
create policy "read own family"
  on families for select
  to authenticated
  using (id = public.my_family_id());
