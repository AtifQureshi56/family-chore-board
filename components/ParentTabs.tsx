'use client';

import { useState } from 'react';

type Tab = { id: string; label: string; icon: string; content: React.ReactNode };

/** Simple tab strip. Big targets - this is used on the same tablet as the board. */
export default function ParentTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 rounded-2xl px-5 font-bold shadow-sm ring-1 transition ${
              active === tab.id
                ? 'bg-foreground text-white ring-transparent'
                : 'bg-surface text-muted ring-black/10'
            }`}
            style={{ height: 64 }}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
        {current?.content}
      </section>
    </div>
  );
}
