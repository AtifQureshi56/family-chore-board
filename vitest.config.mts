import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not url.pathname: this project lives under a path with a space
// in it, which pathname would hand back percent-encoded.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Component. The modules under
      // test are server modules by design, so it is stubbed for the test run.
      'server-only': resolve(root, 'tests/stubs/server-only.ts'),
      '@': resolve(root, '.'),
    },
  },
  test: {
    environment: 'node',
    // Integration tests hit one shared Supabase project; parallel files would
    // fight over the same rows.
    fileParallelism: false,
    // A network round trip per assertion adds up; the default 5s is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnvLocal(),
  },
});

/** Integration tests need the same Supabase keys the app uses. */
function loadEnvLocal(): Record<string, string> {
  const path = resolve(root, '.env.local');
  if (!existsSync(path)) return {};

  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}
