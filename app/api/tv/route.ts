import { NextResponse } from 'next/server';
import { getLatestCompletion, getTvBoardData } from '@/lib/queries';
import { currentSlot, todayInKarachi } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export type TvSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

async function buildSnapshot() {
  // Resolved fresh on every poll, not captured once: a board left running
  // overnight must roll over to the new Karachi day by itself.
  const date = todayInKarachi();

  const [children, latest] = await Promise.all([
    getTvBoardData(date),
    getLatestCompletion(date),
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
    return NextResponse.json(await buildSnapshot(), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load the board' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
