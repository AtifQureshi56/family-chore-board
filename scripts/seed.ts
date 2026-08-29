/**
 * Seeds a demo board: two sample children, the shared default chore list, and a
 * parent PIN.
 *
 *   npm run seed
 *
 * Since families arrived this is a development convenience, not part of setup.
 * A real parent signs in with Google and gets a family with the default chore
 * list already in it; they choose their own PIN in the parent zone. What this
 * script does is fill in the *claimable* family - the one the next Google
 * sign-in adopts - so a local board has something on it before you sign in.
 *
 * Safe to re-run: it clears the claimable family's children and tasks first. It
 * never touches a family that has already been claimed by a real account.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pin = process.env.SEED_PARENT_PIN ?? '1234';

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example to .env.local and fill in your Supabase keys.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const CHILDREN = [
  { name: 'Zara', color: '#EC4899', avatar: '🦋', sort_order: 1 },
  { name: 'Ali', color: '#3B82F6', avatar: '🚀', sort_order: 2 },
];

/** The shared default list. child_id stays null: every child sees these. */
const TASKS = [
  { title: 'Brush your teeth', icon: '🪥', slot: 'morning', points: 5, sort_order: 1 },
  { title: 'Make your bed', icon: '🛏️', slot: 'morning', points: 5, sort_order: 2 },
  { title: 'Get dressed', icon: '👕', slot: 'morning', points: 5, sort_order: 3 },
  { title: 'Eat your breakfast', icon: '🥣', slot: 'morning', points: 5, sort_order: 4 },
  { title: 'Homework', icon: '📒', slot: 'afternoon', points: 5, sort_order: 1 },
  { title: 'Tidy your toys', icon: '🧸', slot: 'afternoon', points: 5, sort_order: 2 },
  { title: 'Help clear the table', icon: '🍽️', slot: 'evening', points: 5, sort_order: 1 },
  { title: 'Brush your teeth', icon: '🪥', slot: 'bedtime', points: 5, sort_order: 1 },
  { title: 'Pyjamas on', icon: '🌙', slot: 'bedtime', points: 5, sort_order: 2 },
];

/**
 * The family the next sign-in will adopt. Reused rather than recreated, so
 * running the seed twice does not leave a queue of empty families waiting to be
 * claimed by unrelated people.
 */
async function claimableFamilyId(): Promise<string> {
  const { data: existing, error: findError } = await db
    .from('families')
    .select('id')
    .eq('claimable', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from('families')
    .insert({ name: 'My family', claimable: true })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function main() {
  const familyId = await claimableFamilyId();
  console.log(`Seeding the unclaimed family ${familyId}...`);

  console.log('Clearing its children and tasks...');
  await db.from('tasks').delete().eq('family_id', familyId);
  await db.from('children').delete().eq('family_id', familyId);

  console.log(`Inserting ${CHILDREN.length} children...`);
  const { data: children, error: childError } = await db
    .from('children')
    .insert(CHILDREN.map((c) => ({ ...c, family_id: familyId })))
    .select('id,name');
  if (childError) throw childError;

  console.log(`Inserting ${TASKS.length} shared tasks...`);
  const { error: taskError } = await db
    .from('tasks')
    .insert(TASKS.map((t) => ({ ...t, family_id: familyId })));
  if (taskError) throw taskError;

  console.log('Setting the parent PIN...');
  const { error: pinError } = await db
    .from('settings')
    .upsert(
      { family_id: familyId, key: 'parent_pin_hash', value: bcrypt.hashSync(pin, 10) },
      { onConflict: 'family_id,key' },
    );
  if (pinError) throw pinError;

  console.log('\nSeeded:');
  for (const c of children ?? []) console.log(`  - ${c.name}`);
  console.log(`  - ${TASKS.length} shared chores across all four slots`);
  console.log(`  - parent PIN: ${pin}  (change it in the parent zone)`);
  console.log('\nSign in with Google to adopt this board.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});
