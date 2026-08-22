-- Family Chore Board — initial schema
-- All dates in this schema are Asia/Karachi calendar dates, never UTC.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- children
create table children (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  color      text        not null,               -- hex, e.g. #3B82F6
  avatar     text        not null,               -- emoji
  sort_order int         not null,
  is_active  boolean     not null default true,  -- soft delete
  created_at timestamptz not null default now()
);

create index children_active_idx on children (is_active, sort_order);

-- ------------------------------------------------------------------- tasks
-- child_id null  = shared default chore, every child sees it (spec v1 behaviour)
-- child_id set   = extra chore, visible to that one child only
-- on_date  null  = recurring, shows every day
-- on_date  set   = one-off, shows only on that date
-- created_on     = the day the chore started existing, so a newly added chore
--                  cannot retroactively break a past perfect day
create table tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text    not null,
  icon       text    not null,
  slot       text    not null check (slot in ('morning','afternoon','evening','bedtime')),
  points     int     not null default 5 check (points > 0),
  sort_order int     not null,
  is_active  boolean not null default true,
  child_id   uuid    null references children(id) on delete cascade,
  on_date    date    null,
  created_on date    not null default ((now() at time zone 'Asia/Karachi')::date),
  created_at timestamptz not null default now()
);

create index tasks_visible_idx on tasks (is_active, child_id, on_date);
create index tasks_slot_idx    on tasks (slot, sort_order);

-- ------------------------------------------------------------- completions
create table completions (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references children(id) on delete cascade,
  task_id        uuid not null references tasks(id)    on delete cascade,
  completed_on   date not null,                 -- local Karachi date, NOT UTC
  points_awarded int  not null,                 -- snapshot of tasks.points at check time
  created_at     timestamptz not null default now(),
  unique (child_id, task_id, completed_on)      -- makes double-scoring impossible
);

create index completions_child_date_idx on completions (child_id, completed_on);
create index completions_date_idx       on completions (completed_on);
create index completions_recent_idx     on completions (created_at desc);

-- ------------------------------------------------------------- perfect_days
-- Recorded at the moment the day is completed. The set of chores a child had on
-- a past date cannot be reliably reconstructed once extra chores exist, so the
-- streak counter reads this table rather than recomputing history.
create table perfect_days (
  child_id uuid not null references children(id) on delete cascade,
  on_date  date not null,
  earned_at timestamptz not null default now(),
  primary key (child_id, on_date)
);

-- ---------------------------------------------------------------- settings
create table settings (
  key   text primary key,
  value jsonb not null
);

-- ----------------------------------------------------------------- realtime
-- The TV board subscribes to completions.
alter publication supabase_realtime add table completions;
