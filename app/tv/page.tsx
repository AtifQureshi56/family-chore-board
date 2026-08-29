import TvBoard from '@/components/TvBoard';
import TvStage from '@/components/TvStage';
import { getLatestCompletion, getTvBoardData } from '@/lib/queries';
import { requireFamily } from '@/lib/session';
import { currentSlot, todayInKarachi } from '@/lib/dates';

// Never cached, never prerendered: this is a live view of a shared database.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Family Board',
  // A wall display should never end up in search results.
  robots: { index: false, follow: false },
};

export default async function TvPage() {
  const { familyId } = await requireFamily();
  const date = todayInKarachi();
  const [children, latest] = await Promise.all([
    getTvBoardData(familyId, date),
    getLatestCompletion(familyId, date),
  ]);

  return (
    <TvStage>
      <TvBoard initial={{ date, slot: currentSlot(), children, latest }} />
    </TvStage>
  );
}
