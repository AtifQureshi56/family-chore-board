/**
 * Setup verifier: confirms the keys work, the tables exist, and the browser key
 * cannot reach anything it shouldn't.
 *
 *   npm run check
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !secret || !publishable) {
  console.error('Missing keys. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const TABLES = ['children', 'tasks', 'completions', 'perfect_days', 'settings'] as const;

const server = createClient(url, secret, { auth: { persistSession: false } });
const browser = createClient(url, publishable, { auth: { persistSession: false } });

let failures = 0;
const pass = (msg: string) => console.log(`  ok    ${msg}`);
const fail = (msg: string) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};

async function main() {
  console.log('\nRoles');
  for (const [label, client] of [
    ['secret key', server],
    ['publishable key', browser],
  ] as const) {
    const { data, error } = await client.rpc('whoami');
    if (error) fail(`${label}: ${error.message}`);
    else console.log(`  ${label} -> ${data}`);
  }

  console.log('\nServer access (needs all five)');
  for (const table of TABLES) {
    const { data, error } = await server.from(table).select('*').limit(1);
    if (error) fail(`${table}: ${error.message}`);
    else pass(`${table} readable`);
    void data;
  }

  console.log('\nBrowser access (completions only)');
  const completions = await browser.from('completions').select('*').limit(1);
  if (completions.error) fail(`completions should be readable: ${completions.error.message}`);
  else pass('completions readable (needed for the TV board realtime feed)');

  for (const table of ['children', 'tasks', 'perfect_days', 'settings'] as const) {
    const { data, error } = await browser.from(table).select('*').limit(1);
    // RLS with no policy returns an empty set rather than an error; both are locked.
    if (error || (data ?? []).length === 0) pass(`${table} not exposed to the browser`);
    else fail(`${table} IS READABLE FROM THE BROWSER`);
  }

  console.log('\nRow counts');
  for (const table of TABLES) {
    const { count } = await server.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count ?? '?'}`);
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nCheck failed:', err.message ?? err);
  process.exit(1);
});
