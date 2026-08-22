# Family Chore Board — Project Spec

A home chore-tracking app for children. Each child has their own account on a shared
family tablet, works through a daily routine of tasks, and earns 5 points per completed
task. Daily and monthly totals are calculated per child.

**Target users:** children aged roughly 4–12, plus one parent administrator.
**Device:** one shared family tablet or laptop, installed as a PWA.
**Timezone:** Asia/Karachi.

---

## 1. Product rules

These are the non-negotiable behaviours. Everything else is implementation detail.

1. Opening the app shows a picker of all active children. No login, no password.
2. Tapping a child opens that child's tasks for **today only**.
3. Tasks are grouped into four slots: `morning`, `afternoon`, `evening`, `bedtime`.
4. Tapping a task toggles it complete/incomplete. The child's check is final —
   there is no parent approval step.
5. Each completed task awards its `points` value (default 5).
6. Days lock at local midnight. A child cannot check or uncheck a task on a past date.
7. A "perfect day" is all of that child's active tasks completed. It triggers a
   celebration and is recorded for the streak counter.
8. Monthly total = sum of all points earned by that child in the current calendar month.
9. The parent zone is behind a 4-digit PIN and controls: adding children, removing
   children, editing the task list, and correcting a past day.
10. Removing a child hides them from the picker but preserves their history.

---

## 2. Data model

### `children`
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | `default gen_random_uuid()` |
| `name` | text, not null | display name |
| `color` | text, not null | hex, e.g. `#3B82F6` — used as that child's theme |
| `avatar` | text, not null | emoji or icon key |
| `sort_order` | int, not null | order in the picker |
| `is_active` | boolean, default true | soft delete |
| `created_at` | timestamptz, default now() | |

### `tasks`
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `title` | text, not null | e.g. "Brush teeth" |
| `icon` | text, not null | emoji or icon key |
| `slot` | text, not null | check in (`morning`,`afternoon`,`evening`,`bedtime`) |
| `points` | int, not null, default 5 | |
| `sort_order` | int, not null | order within its slot |
| `is_active` | boolean, default true | soft delete |

> v1 uses one shared task list for all children. If per-child task lists are needed
> later, add a `child_tasks (child_id, task_id)` join table — the schema is ready for it.

### `completions`
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `child_id` | uuid, fk → children.id | |
| `task_id` | uuid, fk → tasks.id | |
| `completed_on` | date, not null | local Karachi date, NOT UTC |
| `points_awarded` | int, not null | snapshot of `tasks.points` at check time |
| `created_at` | timestamptz, default now() | |

**Constraint:** `unique (child_id, task_id, completed_on)`
**Indexes:** `(child_id, completed_on)`, `(completed_on)`

Checking a task inserts a row. Unchecking deletes it. The unique constraint makes
double-scoring structurally impossible.

`points_awarded` is snapshotted so that changing a task's point value later does not
silently rewrite past scores.

### `settings`
| column | type | notes |
|---|---|---|
| `key` | text, pk | e.g. `parent_pin_hash` |
| `value` | jsonb | |

---

## 3. Critical implementation notes

### Timezone
All "today" logic must resolve to the **Asia/Karachi** calendar date. A single helper
owns this:

```ts
// lib/dates.ts
export function todayInKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
  }).format(new Date()); // returns "YYYY-MM-DD"
}
```

`new Date()` must never be used to derive a date anywhere else in the codebase.
Without this, anything checked after 05:00 local time logs to the previous day.

### Optimistic UI
Task toggling must feel instant. Update local state immediately, fire the server
action, and roll back on error. A child who taps and waits 400ms for a spinner will
tap again and create confusing state.

### Past-day writes
The toggle server action must reject any write where `completed_on !== todayInKarachi()`,
unless an explicit `parentOverride: true` flag is passed from the parent zone.

---

## 4. Routes and components

```
app/
  layout.tsx                  root layout, PWA metadata
  page.tsx                    child picker
  child/[id]/page.tsx         my day
  scoreboard/page.tsx         month totals
  parent/page.tsx             PIN-gated settings
  actions/
    toggleTask.ts
    manageChildren.ts
    manageTasks.ts
    verifyPin.ts

components/
  ChildCard.tsx               big colored tile: avatar, name, today's stars
  ProgressRing.tsx            circular progress, filled with the child's color
  StarCounter.tsx             animated count-up number
  SlotSection.tsx             heading + list of TaskCards for one slot
  TaskCard.tsx                large tappable row: icon, title, check state, points
  CelebrationOverlay.tsx      confetti on perfect day
  PinGate.tsx                 4-digit numeric entry
  ChildForm.tsx               add/edit a child (name, color, avatar)
  TaskForm.tsx                add/edit a task (title, icon, slot, points)
  MonthChart.tsx              bar chart of monthly totals per child

lib/
  supabase.ts                 client
  queries.ts                  all DB reads
  dates.ts                    todayInKarachi, monthRange, formatting
  types.ts                    shared TypeScript types
```

---

## 5. Server actions

| Action | Input | Behaviour |
|---|---|---|
| `toggleTask` | `childId`, `taskId` | Insert if absent, delete if present. Rejects non-today dates without parent override. Returns the child's new day total. |
| `addChild` | `name`, `color`, `avatar` | Appends at end of `sort_order`. |
| `removeChild` | `childId` | Sets `is_active = false`. Requires PIN. |
| `saveTask` | task fields | Upsert. Requires PIN. |
| `removeTask` | `taskId` | Sets `is_active = false`. Requires PIN. |
| `verifyPin` | `pin` | Compares against hashed value in `settings`. |

---

## 6. Queries

| Query | Returns |
|---|---|
| `getActiveChildren()` | All children where `is_active`, ordered by `sort_order` |
| `getDayForChild(childId, date)` | Active tasks joined with that child's completions for the date |
| `getDayTotals(date)` | Points per child for one date — powers the picker badges |
| `getMonthTotals(year, month)` | Points per child for the month |
| `getPerfectDayStreak(childId)` | Consecutive days where all active tasks were completed |

---

## 7. Design direction

Children are the primary users, so the interface is icon-first and touch-first.

- **Minimum tap target 64px tall.** Younger children have poor fine motor control.
- **Icon before text**, always. Pre-readers navigate by icon and color.
- **Each child owns a color.** Their day screen, progress ring, and picker tile all
  use it. This ownership is a large part of the motivation.
- **Never use red for an incomplete task.** Incomplete is neutral grey and waiting,
  not a failure state. The app rewards; it does not scold.
- **Completed tasks stay visible**, styled as done, so the child can see their progress
  rather than watching items disappear.
- Progress shown as a filling ring, not a percentage.
- Sound and animation on check: a short pop and a bouncing checkmark.
- Confetti and a badge on a perfect day.

---

## 8. Build phases

Each phase is independently demonstrable. Do not begin a phase until the previous
one works end to end.

### Phase 1 — Skeleton
- Next.js 15 + TypeScript + Tailwind scaffolded
- Supabase project created, env vars wired
- All four tables created via migration
- Seed script inserts 2 sample children and ~8 sample tasks
- **Done when:** the app runs locally and a query returns seeded rows

### Phase 2 — Read-only
- Child picker renders real children from the DB
- Tapping a child routes to their day view
- Day view renders tasks grouped by slot, with correct completion state
- Nothing is interactive yet
- **Done when:** manually inserting a completion row changes what the screen shows

### Phase 3 — The core loop
- `toggleTask` server action implemented with the date guard
- TaskCard toggles with optimistic UI
- Day total and progress ring update live
- Picker badges show each child's today total
- **Done when:** a child can complete a full day and the score is correct

> **Stop here and use it for one week before continuing.** Phase 3 is the whole
> product. Real use will change the requirements for everything below.

### Phase 4 — Parent zone
- PIN gate with hashed PIN in `settings`
- Add child, remove child (soft delete), reorder
- Add/edit/remove tasks, set points, assign slot
- Correct a past day via parent override
- **Done when:** the task list can be changed without touching the database directly

### Phase 5 — Scoreboard
- Month totals per child with bar chart
- Calendar view marking perfect days
- Streak counter
- **Done when:** monthly totals reconcile against a manual count

### Phase 6 — Delight and deploy
- Check animation, sound, confetti on perfect day
- Badges for streaks and monthly milestones
- PWA manifest, icons, `display: standalone`
- Deploy to Vercel, install to the tablet home screen
- **Done when:** the app opens from a home screen icon with no browser chrome

---

## 9. Acceptance tests

Write these first if following a TDD workflow.

1. Toggling an unchecked task creates exactly one completion row.
2. Toggling it again deletes that row.
3. Toggling twice rapidly does not create two rows.
4. A task checked at 23:59 Karachi and one checked at 00:01 log to different dates.
5. A task checked at 06:00 Karachi logs to that day, not the previous UTC day.
6. Changing a task's point value does not alter any existing completion's score.
7. Soft-deleting a child removes them from the picker but preserves their month total.
8. A write to yesterday's date fails without `parentOverride`.
9. The parent zone is unreachable without a correct PIN.
10. Day total equals the sum of `points_awarded` for that child and date.

---

## 10. Deliberately out of scope for v1

Listed so they don't creep in mid-build:

- Per-child task lists (schema supports it; UI does not)
- Rewards, allowance, or point redemption
- Photo proof of completion
- Notifications or reminders
- Per-child logins or accounts on separate personal devices
- An interactive TV interface (the TV display is strictly read-only)
- Recurring tasks on specific weekdays only

---

## 11. TV family board

A second, **read-only** view of the same data, designed to run permanently on a TV,
monitor, or laptop screen in a shared family space. The tablet is where children act;
the TV is where the family sees.

### Route

`/tv` — a client component, `export const dynamic = 'force-dynamic'`, no PIN, no
navigation, no interactive elements of any kind. A smart TV remote cannot usefully
operate a web UI, so nothing on this screen responds to input.

### Content

Six elements maximum. This is glanced at from across a room, not read.

1. Today's date and the current time slot (morning / afternoon / evening / bedtime)
2. One column per active child, each showing: avatar, name, today's points, a progress
   bar, tasks completed out of total, and month-to-date total
3. A perfect-day marker replacing the progress text when a child finishes everything
4. A live activity strip announcing the most recent completion, e.g.
   "Zara just finished take a shower  +5"
5. Optional: a month leaderboard that alternates in every 30 seconds
6. Nothing else

### 10-foot design constraints

- Fixed 1920×1080 landscape. No responsive breakpoints required.
- Body text minimum 32px; child point totals 96–120px; headings 56–72px.
- 5% padding on all four sides to survive TV overscan cropping.
- High contrast, large solid blocks of each child's color. No thin borders,
  no small icons, no fine detail.
- Burn-in protection: translate the whole layout by 1–3px on a slow cycle
  (once per minute), and reduce brightness after a configured bedtime hour.

### Sync layer

Two independent mechanisms, both required:

| Mechanism | Purpose |
|---|---|
| Supabase Realtime subscription on `completions` | Instant updates and the live activity strip |
| `setInterval` full refetch every 30s | Fallback when the websocket drops — cheap TV hardware and overnight wifi blips make this non-optional |

Additionally, schedule a hard `window.location.reload()` once daily at approximately
04:00 local. Long-lived browser tabs leak memory and eventually freeze; a silent stale
dashboard is worse than a blank one.

The activity strip should display the most recent completion and fade after ~20 seconds,
returning to a neutral state. Do not queue or stack notifications.

### Deployment options

Ordered by how quickly you can test the idea:

| Option | Notes |
|---|---|
| Laptop or old tablet on an HDMI cable | Start here. Free, full Chrome, zero setup |
| Cast a browser tab from a laptop | Free, but the source device must stay awake |
| Fire TV Stick + Silk browser | Cheap, workable, no auto-start on boot |
| Android TV box + Fully Kiosk Browser | Best cheap permanent setup: auto-start, auto-refresh, scheduled screen on/off |
| Raspberry Pi + Chromium `--kiosk` | Most reliable; boots directly into the board |
| The TV's own built-in browser | Test it, but do not design around it — engines are old and often can't sustain a long-lived page |

Validate with an HDMI cable before purchasing any hardware.

### Additional queries required

| Query | Returns |
|---|---|
| `getTvBoardData(date)` | All active children with today's points, completed/total counts, perfect-day flag, and month-to-date total — in a single round trip |
| `getLatestCompletion()` | Most recent completion with child name and task title, for the activity strip |

`getTvBoardData` must be one query. The TV polls it every 30 seconds indefinitely;
an N+1 pattern here will quietly consume the Supabase free tier.

### Build phase

Slots in as **Phase 7**, after the core product is proven. Requires Phase 3 (completions
being written) and Phase 5 (month totals) to be working first.

- **Done when:** the board runs unattended for 24 hours, survives a wifi drop,
  and updates within 30 seconds of a task being checked on the tablet.
