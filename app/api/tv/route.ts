import { NextResponse } from 'next/server';
import { getLatestCompletion, getTvBoardData } from '@/lib/queries';
import { getFamilySession } from '@/lib/session';
import { currentSlot, todayInKarachi } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export type TvSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

async function buildSnapshot(familyId: string) {
  // Resolved fresh on every poll, not captured once: a board left running
  // overnight must roll over to the new Karachi day by itself.
  const date = todayInKarachi();

  const [children, latest] = await Promise.all([
    getTvBoardData(familyId, date),
    getLatestCompletion(familyId, date),
  ]);

  return { date, slot: currentSlot(), children, latest };
}

/**
 * Everything the TV board draws, in one request.
 *
 * The board polls this every 30 seconds indefinitely and also calls it whenever
 * Supabase Realtime reports a change, so it must stay cheap and must never be
 * cached anywhere between here and the screen.
 */
export async function GET() {
  try {
    const session = await getFamilySession();
    // 401, not 500: a board whose session finally lapsed after weeks on the wall
    // needs the parent to sign in again, and that is worth saying plainly rather
    // than hiding behind "could not load".
    if (!session) {
      return NextResponse.json(
        { error: 'Signed out. Sign in again on this device.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(await buildSnapshot(session.familyId), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load the board' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
