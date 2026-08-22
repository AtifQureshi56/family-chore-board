/**
 * Seeds the shared default chore list, two sample children, and the parent PIN.
 *
 *   npm run seed
 *
 * Safe to re-run: it clears children/tasks first. It does NOT clear completions
 * blindly - it cascades, so only run this while the data is still disposable.
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

async function main() {
  console.log('Clearing children and tasks...');
  await db.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('children').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log(`Inserting ${CHILDREN.length} children...`);
  const { data: children, error: childError } = await db
    .from('children')
    .insert(CHILDREN)
    .select('id,name');
  if (childError) throw childError;

  console.log(`Inserting ${TASKS.length} shared tasks...`);
  const { error: taskError } = await db.from('tasks').insert(TASKS);
  if (taskError) throw taskError;

  console.log('Setting the parent PIN...');
  const { error: pinError } = await db
    .from('settings')
    .upsert({ key: 'parent_pin_hash', value: bcrypt.hashSync(pin, 10) });
  if (pinError) throw pinError;

  console.log('\nSeeded:');
  for (const c of children ?? []) console.log(`  - ${c.name}`);
  console.log(`  - ${TASKS.length} shared chores across all four slots`);
  console.log(`  - parent PIN: ${pin}  (change it in the parent zone)`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});
