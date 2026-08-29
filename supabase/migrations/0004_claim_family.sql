-- Turning a fresh Google sign-in into a usable board, atomically.
--
-- This has to be one transaction in the database rather than a sequence of calls
-- from the app. Two browser tabs finishing the OAuth dance at the same moment
-- would otherwise both find "no family" and both create one, leaving the parent
-- with two half-empty boards and no way to tell which is which.

create or replace function public.claim_or_create_family(p_user_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  -- Already signed in before: nothing to do.
  select family_id into fid from family_members where user_id = p_user_id;
  if fid is not null then
    return fid;
  end if;

  -- Adopt the pre-auth board if it is still going. `for update skip locked` means
  -- a second concurrent login walks past it and creates its own family instead of
  -- blocking or double-claiming.
  select id into fid
    from families
   where claimable
   order by created_at
   limit 1
     for update skip locked;

  if fid is not null then
    update families set claimable = false where id = fid;
  else
    insert into families (name) values ('My family') returning id into fid;

    -- A new family lands on a board that already works. An empty chore list on
    -- day one reads as a broken app, not as a blank canvas.
    insert into tasks (family_id, title, icon, slot, points, sort_order, child_id, on_date)
    values
      (fid, 'Brush your teeth',     '🪥',  'morning',   5, 1, null, null),
      (fid, 'Make your bed',        '🛏️',  'morning',   5, 2, null, null),
      (fid, 'Get dressed',          '👕',  'morning',   5, 3, null, null),
      (fid, 'Eat your breakfast',   '🥣',  'morning',   5, 4, null, null),
      (fid, 'Homework',             '📒',  'afternoon', 5, 1, null, null),
      (fid, 'Tidy your toys',       '🧸',  'afternoon', 5, 2, null, null),
      (fid, 'Help clear the table', '🍽️',  'evening',   5, 1, null, null),
      (fid, 'Brush your teeth',     '🪥',  'bedtime',   5, 1, null, null),
      (fid, 'Pyjamas on',           '🌙',  'bedtime',   5, 2, null, null);
  end if;

  insert into family_members (user_id, family_id, email)
  values (p_user_id, fid, p_email)
  on conflict (user_id) do nothing;

  -- Lost the race after all: use whatever the winner wrote.
  select family_id into fid from family_members where user_id = p_user_id;
  return fid;
end $$;

-- Only the server, holding the secret key, may call this. It is the one function
-- that can create a tenant, so it must never be reachable from a browser.
revoke all on function public.claim_or_create_family(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_or_create_family(uuid, text) to service_role;
