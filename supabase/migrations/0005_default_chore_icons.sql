-- Repairing the default chore icons, and stopping them from breaking again.
--
-- Migrations are applied by pasting them into the Supabase SQL editor. A file
-- saved as UTF-8 but read by the editor as Windows-1252 arrives with every emoji
-- already mangled - one emoji arrives as four Latin-1 letters - and the server
-- stores that faithfully. Every family created by the first-sign-in function
-- since then got a chore list whose icons render as gibberish. Boards written by
-- the app itself were fine: it speaks UTF-8 to the server over HTTPS.
--
-- So no emoji appears literally in this file. Each icon is built with chr() from
-- its Unicode code point, which is plain ASCII and therefore survives whatever
-- encoding a client guesses on the way in. chr() rather than the U-ampersand
-- escape form, because that form is refused outright when the session has
-- standard_conforming_strings off, and a migration that only works under the
-- right session setting is the kind of thing that fails quietly and gets missed.
--
-- Icons, in the order they appear below:
--   chr(129701)              U+1FAA5           toothbrush
--   chr(128719)||chr(65039)  U+1F6CF U+FE0F    bed
--   chr(128085)              U+1F455           t-shirt
--   chr(129379)              U+1F963           bowl with spoon
--   chr(128210)              U+1F4D2           ledger
--   chr(129528)              U+1F9F8           teddy bear
--   chr(127869)||chr(65039)  U+1F37D U+FE0F    plate and cutlery
--   chr(127769)              U+1F319           crescent moon

-- ------------------------------------------------------------- the source
-- Unchanged from 0004 apart from how the nine icons are spelled.

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
      (fid, 'Brush your teeth',     chr(129701),                'morning',   5, 1, null, null),
      (fid, 'Make your bed',        chr(128719) || chr(65039),  'morning',   5, 2, null, null),
      (fid, 'Get dressed',          chr(128085),                'morning',   5, 3, null, null),
      (fid, 'Eat your breakfast',   chr(129379),                'morning',   5, 4, null, null),
      (fid, 'Homework',             chr(128210),                'afternoon', 5, 1, null, null),
      (fid, 'Tidy your toys',       chr(129528),                'afternoon', 5, 2, null, null),
      (fid, 'Help clear the table', chr(127869) || chr(65039),  'evening',   5, 1, null, null),
      (fid, 'Brush your teeth',     chr(129701),                'bedtime',   5, 1, null, null),
      (fid, 'Pyjamas on',           chr(127769),                'bedtime',   5, 2, null, null);
  end if;

  insert into family_members (user_id, family_id, email)
  values (p_user_id, fid, p_email)
  on conflict (user_id) do nothing;

  -- Lost the race after all: use whatever the winner wrote.
  select family_id into fid from family_members where user_id = p_user_id;
  return fid;
end $$;

revoke all on function public.claim_or_create_family(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_or_create_family(uuid, text) to service_role;

-- ------------------------------------------------- the boards already out there
-- Matched on title and slot rather than blanket-replacing every icon, and skipped
-- where the icon is already correct, so this cannot disturb a chore a parent has
-- since renamed or given their own emoji. Safe to re-run; it becomes a no-op.

update tasks t
   set icon = fixed.icon
  from (values
    ('Brush your teeth',     'morning',   chr(129701)),
    ('Make your bed',        'morning',   chr(128719) || chr(65039)),
    ('Get dressed',          'morning',   chr(128085)),
    ('Eat your breakfast',   'morning',   chr(129379)),
    ('Homework',             'afternoon', chr(128210)),
    ('Tidy your toys',       'afternoon', chr(129528)),
    ('Help clear the table', 'evening',   chr(127869) || chr(65039)),
    ('Brush your teeth',     'bedtime',   chr(129701)),
    ('Pyjamas on',           'bedtime',   chr(127769))
  ) as fixed(title, slot, icon)
 where t.child_id is null
   and t.title = fixed.title
   and t.slot  = fixed.slot
   and t.icon <> fixed.icon;

-- --------------------------------------------------------------- did it work
-- Run as the last statement so the editor's result pane answers the question
-- instead of leaving you to scroll for an error. Both columns must say ok.

select
  case when pg_get_functiondef('public.claim_or_create_family(uuid,text)'::regprocedure)
            like '%chr(129701)%'
       then 'ok - new families will get correct icons'
       else 'FAILED - function was not replaced' end                as function_status,
  -- Every real emoji sits far above code point 255; a mangled one starts with a
  -- stray Latin-1 letter. No backslash anywhere, so this cannot misread either.
  case when (select count(*) from tasks where ascii(icon) between 128 and 255) = 0
       then 'ok - no mangled icons left'
       else 'FAILED - mangled icons remain' end                     as existing_boards;
