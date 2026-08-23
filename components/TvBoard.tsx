'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { SLOT_META } from '@/lib/types';
import { formatLongDate } from '@/lib/dates';
import type { TvSnapshot } from '@/app/api/tv/route';

/**
 * The read-only family board. Designed for a 1920x1080 screen glanced at from
 * across a room, running unattended for weeks.
 *
 * Nothing here responds to input: a TV remote cannot usefully operate a web UI,
 * so there are no links, no buttons and no focusable elements at all.
 */

/** Poll interval. The websocket is the fast path; this is the safety net. */
const POLL_MS = 30_000;
/** How long a completion stays on the activity strip. */
const ACTIVITY_MS = 20_000;
/** Burn-in nudge cadence. */
const NUDGE_MS = 60_000;
/** Local hour after which the board dims. Overridable with ?dim=22. */
const DEFAULT_BEDTIME_HOUR = 21;
/** A long-lived tab leaks memory and eventually freezes; reload once a day. */
const RELOAD_HOUR = 4;

export default function TvBoard({ initial }: { initial: TvSnapshot }) {
  const [data, setData] = useState<TvSnapshot>(initial);
  const [stale, setStale] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [clock, setClock] = useState<Date | null>(null);

  // The activity strip shows one completion at a time and is never queued.
  const [activity, setActivity] = useState<TvSnapshot['latest']>(null);
  const lastSeenRef = useRef<string | null>(initial.latest?.at ?? null);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tv', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const next: TvSnapshot = await res.json();

      setData(next);
      setStale(false);

      // A completion we have not announced yet.
      if (next.latest && next.latest.at !== lastSeenRef.current) {
        lastSeenRef.current = next.latest.at;
        setActivity(next.latest);

        if (activityTimer.current) clearTimeout(activityTimer.current);
        activityTimer.current = setTimeout(() => setActivity(null), ACTIVITY_MS);
      }
    } catch {
      // Keep showing the last good data, but say so. A silent stale dashboard is
      // worse than one that admits it has lost contact.
      setStale(true);
    }
  }, []);

  // 1. The polling fallback. Required, not optional: cheap TV hardware and
  //    overnight wifi blips drop websockets without ever reporting it.
  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // 2. Realtime, for instant updates and the activity strip.
  useEffect(() => {
    let client: ReturnType<typeof createBrowserClient>;
    try {
      client = createBrowserClient();
    } catch {
      return; // no anon key: polling alone still works
    }

    const channel = client
      .channel('tv-completions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  // Refetch as soon as the tab is visible again, so a board that was asleep is
  // never showing yesterday.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Clock, burn-in nudge, and the daily reload.
  useEffect(() => {
    setClock(new Date());

    const tick = setInterval(() => setClock(new Date()), 30_000);
    const nudger = setInterval(() => setNudge((n) => (n + 1) % 4), NUDGE_MS);

    const reloader = setInterval(() => {
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          hour12: false,
        }).format(new Date()),
      );
      if (hour === RELOAD_HOUR) window.location.reload();
    }, 10 * 60_000);

    return () => {
      clearInterval(tick);
      clearInterval(nudger);
      clearInterval(reloader);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (activityTimer.current) clearTimeout(activityTimer.current);
    };
  }, []);

  const bedtimeHour = readBedtimeHour();
  const localHour = clock
    ? Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          hour12: false,
        }).format(clock),
      )
    : 12;
  const dimmed = localHour >= bedtimeHour || localHour < 6;

  const slot = SLOT_META[data.slot];
  const ranked = [...data.children].sort((a, b) => b.monthPoints - a.monthPoints);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        // 1-3px drift on a slow cycle so no pixel holds the same colour for weeks.
        transform: `translate(${nudge}px, ${nudge % 3}px)`,
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity 4s linear, transform 2s linear',
        // 5% padding on all four sides survives TV overscan cropping.
        padding: '54px 96px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
        background: '#0b1020',
        color: '#ffffff',
      }}
    >
      {/* 1. Today's date and the current slot */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 32 }}>
        <h1 style={{ fontSize: 68, fontWeight: 900, letterSpacing: -1 }}>
          {formatLongDate(data.date)}
        </h1>
        <span style={{ fontSize: 56, fontWeight: 800, opacity: 0.75 }}>
          {slot.icon} {slot.label}
        </span>
        {stale && (
          <span style={{ marginLeft: 'auto', fontSize: 32, fontWeight: 800, color: '#fbbf24' }}>
            Reconnecting…
          </span>
        )}
      </header>

      {/* 2. One column per child */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(data.children.length, 1)}, 1fr)`,
          gap: 32,
          minHeight: 0,
        }}
      >
        {data.children.map((row) => {
          const pct = row.taskCount === 0 ? 0 : (row.completedCount / row.taskCount) * 100;

          return (
            <section
              key={row.child.id}
              style={{
                background: row.child.color,
                borderRadius: 40,
                padding: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                minHeight: 0,
              }}
            >
              <span style={{ fontSize: 96, lineHeight: 1 }}>{row.child.avatar}</span>
              <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: -0.5 }}>
                {row.child.name}
              </span>

              <span style={{ fontSize: 116, fontWeight: 900, lineHeight: 1 }}>{row.points}</span>
              <span style={{ fontSize: 32, fontWeight: 800, opacity: 0.85, marginTop: -8 }}>
                stars today
              </span>

              {/* Thick solid progress block - no thin borders, nothing fine */}
              <div
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 18,
                  background: 'rgba(0,0,0,0.28)',
                  overflow: 'hidden',
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: '#ffffff',
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>

              {/* 3. The perfect-day marker replaces the progress text */}
              <span style={{ fontSize: 38, fontWeight: 900, marginTop: 8 }}>
                {row.isPerfect
                  ? '🎉 All done!'
                  : row.taskCount === 0
                    ? 'No chores today'
                    : `${row.completedCount} of ${row.taskCount} done`}
              </span>

              <span
                style={{
                  marginTop: 'auto',
                  fontSize: 34,
                  fontWeight: 800,
                  opacity: 0.85,
                }}
              >
                {row.monthPoints} this month
              </span>
            </section>
          );
        })}
      </div>

      {/* 4 & 5. The activity strip, falling back to the month leaderboard */}
      <footer
        style={{
          height: 108,
          borderRadius: 32,
          background: activity ? '#ffffff' : 'rgba(255,255,255,0.08)',
          color: activity ? '#0b1020' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          padding: '0 40px',
          transition: 'background 600ms ease, color 600ms ease',
        }}
      >
        {activity ? (
          <>
            <span style={{ fontSize: 56 }}>{activity.taskIcon}</span>
            <span style={{ fontSize: 42, fontWeight: 900 }}>
              <span style={{ color: activity.childColor }}>{activity.childName}</span>
              {' just finished '}
              {activity.taskTitle}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 44,
                fontWeight: 900,
                color: activity.childColor,
              }}
            >
              +{activity.points}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 34, fontWeight: 900, opacity: 0.6 }}>THIS MONTH</span>
            <div style={{ display: 'flex', gap: 44, alignItems: 'center', marginLeft: 8 }}>
              {ranked.map((row, i) => (
                <span
                  key={row.child.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 38 }}
                >
                  <span style={{ fontWeight: 900, opacity: 0.55 }}>{i + 1}</span>
                  <span>{row.child.avatar}</span>
                  <span style={{ fontWeight: 900 }}>{row.child.name}</span>
                  <span style={{ fontWeight: 900, color: row.child.color }}>
                    {row.monthPoints}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </footer>
    </div>
  );
}

/** ?dim=22 overrides the hour the board dims at. */
function readBedtimeHour(): number {
  if (typeof window === 'undefined') return DEFAULT_BEDTIME_HOUR;
  const raw = new URLSearchParams(window.location.search).get('dim');
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : DEFAULT_BEDTIME_HOUR;
}
