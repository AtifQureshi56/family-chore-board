   # Family Chore Board

A chore-tracking PWA for children on a shared family tablet, plus a read-only TV
board. Built from `chore-board-spec.md`.

All calendar dates are **Asia/Karachi** dates. `new Date()` is never used to derive
a date outside `lib/dates.ts`.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).

2. **Copy the keys.** In the dashboard: *Project Settings → API*. Copy `.env.example`
   to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

   The service-role key is server-only. It must never appear in a `NEXT_PUBLIC_` variable.

3. **Run the migration.** In the dashboard: *SQL Editor → New query*, paste the whole
   of `supabase/migrations/0001_init.sql`, and run it.

4. **Seed.**

   ```bash
   npm run seed
   ```

   Inserts two sample children, nine shared chores across the four slots, and the
   parent PIN (`1234` by default — change it in the parent zone).

5. **Run.**

   ```bash
   npm run dev
   ```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run seed` | Reset children + tasks, set the parent PIN |
| `npm test` | Unit tests (dates, scoring) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerate the PWA icons from the SVG in `scripts/icons.ts` |
| `npm run check` | Verify Supabase keys, tables and browser-key lockdown |

## Installing to the tablet

The PWA bits are done: manifest, icons, `display: standalone`, and a service
worker whose only job is installability. It is deliberately **network-first** —
this board is a live view of a shared database, and a cached page quietly showing
yesterday's chores is worse than one that plainly fails to load.

The service worker registers in production builds only, so to test locally:

```bash
npm run build && npm run start
```

A real tablet needs HTTPS, which means deploying first. Then: open the site in
Chrome on the tablet, menu, *Add to home screen*. On iPad: Share, *Add to Home
Screen*. Launched from that icon there is no address bar.

## How chores work

There is **one shared chore list** that every child sees — `tasks` rows with
`child_id = null`. On top of that, a parent can add an **extra chore for one
specific child** from the parent zone, chosen from the dropdown library in
`lib/choreLibrary.ts` or typed in freely. An extra chore is either **today only**
(`on_date` set) or **every day** (`on_date` null). A child with no extras simply
runs the default list.

Every "which chores does this child have today" calculation goes through
`getVisibleTasks()` in `lib/queries.ts`. Do not reimplement that predicate elsewhere.

## Build phases

See `chore-board-spec.md` section 8. Current state: **Phase 6 (delight + PWA) complete** — deploy still to do.

Phase 7 (the TV board) is not built yet.
