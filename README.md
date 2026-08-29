   # Family Chore Board

A chore-tracking PWA for children on a shared family tablet, plus a read-only TV
board. Built from `chore-board-spec.md`.

Every family signs in with Google and gets its own private board. Children,
chores, stars and streaks belong to the account that created them; no family can
see another's, and there is no shared or public view of anyone's data.

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

3. **Run the migrations.** In the dashboard: *SQL Editor → New query*, then paste
   and run each file in `supabase/migrations/` **in order**:

   | File | Adds |
   |---|---|
   | `0001_init.sql` | The tables |
   | `0002_grants_and_rls.sql` | Grants and row-level security |
   | `0003_families_and_auth.sql` | Families, sign-in, and `family_id` on every table |
   | `0004_claim_family.sql` | The function that sets up a family on first sign-in |

   `0003` is safe to run on a database that already has children and chores in it:
   everything already there is gathered into one family and marked *claimable*, and
   the first Google account to sign in adopts it. Nothing is deleted.

4. **Turn on Google sign-in.** Two dashboards, in this order.

   In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   *Create credentials → OAuth client ID → Web application*. Under
   *Authorised redirect URIs* add exactly one entry, the callback Supabase gives
   you on the next screen:

   ```
   https://<your-project>.supabase.co/auth/v1/callback
   ```

   Copy the client ID and client secret.

   In Supabase: *Authentication → Providers → Google*. Enable it and paste both
   values. Then *Authentication → URL Configuration* and add every origin the app
   runs on to **Redirect URLs** — sign-in fails on any origin that is not listed:

   ```
   http://localhost:3000/**
   https://your-app.vercel.app/**
   ```

5. **Seed (optional, local only).**

   ```bash
   npm run seed
   ```

   Fills the unclaimed family with two sample children, nine shared chores and a
   parent PIN (`1234` by default). Skip it and you get an empty board with the
   default chore list already on it, which is what a real new user sees.

6. **Run.**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign in with Google, and choose a parent PIN when
   the parent zone asks for one.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run seed` | Fill the unclaimed family with sample children, chores and a PIN |
| `npm test` | Unit tests (dates, scoring) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerate the PWA icons from the SVG in `scripts/icons.ts` |
| `npm run check` | Verify Supabase keys, tables and browser-key lockdown |

## Deploying to Vercel

The repo lives at https://github.com/AtifQureshi56/family-chore-board (private).

1. Go to https://vercel.com/new and import that repo. Vercel detects Next.js on
   its own — leave every build setting alone.
2. **Before clicking Deploy**, open *Environment Variables* and add all three,
   copied from your local `.env.local`:

   | Name | Where it comes from |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the secret key — **never** rename this to `NEXT_PUBLIC_*` |

   Apply them to Production, Preview and Development.
3. Deploy. Every push to `main` redeploys from then on.
4. **Add the deployed URL to Supabase.** *Authentication → URL Configuration →
   Redirect URLs*, add `https://your-app.vercel.app/**`. Without this, Google
   sends parents back to a sign-in error and nothing else in the app is reachable.

`SEED_PARENT_PIN` is not needed on Vercel — the seed script only ever runs locally.

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

## Accounts, families and privacy

One Google account owns one family. Signing in creates that family, or adopts the
pre-auth board if this is the first sign-in on a database that predates accounts.

Two separate locks, answering different questions:

| Lock | Question it answers | Where it lives |
|---|---|---|
| Google sign-in | *Whose board is this?* | Supabase Auth session cookie, refreshed by `middleware.ts` |
| 4-digit parent PIN | *Is this the parent or the eight-year-old?* | `parent_unlocked` httpOnly cookie, 30 minutes |

The PIN is not redundant. A kitchen tablet stays signed in for weeks, so the
account alone cannot keep a child out of the chore editor.

**How the isolation actually works.** Every table carries a `family_id`, and every
query in `lib/queries.ts` filters on it. Those queries run under the service-role
key, which bypasses row-level security completely — so that filter *is* the wall,
not a convenience. `familyId` always comes from `lib/session.ts`; it is never
accepted from the client. A child id from another family fails `getChild()` and
the page 404s.

`tests/familyIsolation.integration.test.ts` builds two complete families and
checks every read and both write paths from both sides. Run it after any change
to `lib/queries.ts`.

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

See `chore-board-spec.md` section 8. Current state: **all seven phases complete**.

The remaining validation is the spec's own Phase 7 criterion: run the board
unattended for 24 hours, survive a wifi drop, and confirm it updates within 30
seconds of a chore being checked on the tablet.

## The TV board

`/tv` is a read-only wall display for a shared family space. No PIN, no
navigation, and no interactive elements at all — a TV remote cannot usefully
operate a web UI, so nothing responds to input. It does need the family to be
signed in on that device, which is a one-time step when the screen is set up.

It is drawn on a fixed 1920x1080 canvas scaled to fit whatever the screen
reports, with 5% padding on all sides to survive overscan cropping.

Two independent sync mechanisms, both required:

| Mechanism | Purpose |
|---|---|
| Supabase Realtime on `completions` | Instant updates and the activity strip. Runs as the signed-in parent, so it only ever sees this family's rows |
| 30s full refetch of `/api/tv` | Fallback for dropped websockets — cheap TV hardware and overnight wifi blips make this non-optional |

It also refetches whenever the tab becomes visible, shows "Reconnecting..."
rather than going quietly stale, nudges the layout 1-3px each minute against
burn-in, dims after 21:00 (`?dim=22` to change), and hard-reloads at 04:00
because long-lived tabs leak memory and eventually freeze.

Validate on an HDMI cable before buying any hardware.
