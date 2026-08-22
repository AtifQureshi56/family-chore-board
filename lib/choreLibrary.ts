import type { Slot } from './types';

export type ChorePreset = {
  title: string;
  icon: string;
  points: number;
};

/**
 * Presets offered in the parent zone's "add an extra chore" dropdown, grouped by
 * slot. These are deliberately NOT in the database — they are only suggestions.
 * Picking one inserts a normal task row scoped to a single child.
 *
 * Nothing here duplicates the seeded shared list (see scripts/seed.ts), so the
 * dropdown never offers a chore the child already has.
 */
export const CHORE_LIBRARY: Record<Slot, ChorePreset[]> = {
  morning: [
    { title: 'Water the plants', icon: '🪴', points: 5 },
    { title: 'Feed the pet', icon: '🐈', points: 5 },
    { title: 'Open the curtains', icon: '🪟', points: 5 },
    { title: 'Pack your school bag', icon: '🎒', points: 5 },
    { title: 'Fold your pyjamas', icon: '👚', points: 5 },
    { title: 'Wipe the breakfast table', icon: '🧽', points: 5 },
    { title: 'Put shoes on the rack', icon: '👟', points: 5 },
    { title: 'Fill your water bottle', icon: '💧', points: 5 },
  ],
  afternoon: [
    { title: 'Tidy your room', icon: '🧸', points: 10 },
    { title: 'Put away the laundry', icon: '🧺', points: 10 },
    { title: 'Help with the dishes', icon: '🍽️', points: 5 },
    { title: 'Sweep the floor', icon: '🧹', points: 10 },
    { title: 'Take out the rubbish', icon: '🗑️', points: 5 },
    { title: 'Sort the recycling', icon: '♻️', points: 5 },
    { title: 'Dust the shelves', icon: '🪶', points: 5 },
    { title: 'Read for 20 minutes', icon: '📖', points: 10 },
    { title: 'Practice handwriting', icon: '✏️', points: 10 },
  ],
  evening: [
    { title: 'Set the table', icon: '🍴', points: 5 },
    { title: 'Clear the table', icon: '🧼', points: 5 },
    { title: 'Help cook dinner', icon: '🥗', points: 10 },
    { title: 'Wipe the kitchen counter', icon: '🧴', points: 5 },
    { title: 'Water the garden', icon: '🚿', points: 5 },
    { title: 'Put away toys', icon: '🧩', points: 5 },
    { title: 'Charge the tablet', icon: '🔌', points: 5 },
    { title: 'Help a younger sibling', icon: '🤝', points: 10 },
  ],
  bedtime: [
    { title: "Lay out tomorrow's clothes", icon: '👕', points: 5 },
    { title: 'Tidy the bookshelf', icon: '📚', points: 5 },
    { title: 'Put dirty clothes in the basket', icon: '🧺', points: 5 },
    { title: 'Say goodnight to everyone', icon: '💤', points: 5 },
    { title: 'Turn off the lights', icon: '💡', points: 5 },
    { title: 'Check the doors are shut', icon: '🚪', points: 5 },
    { title: 'Plug in the night light', icon: '🌙', points: 5 },
    { title: 'Pack your bag for tomorrow', icon: '🎒', points: 5 },
  ],
};

/** Emoji offered when the parent picks "Custom…" and types their own chore. */
export const EMOJI_CHOICES = [
  '⭐', '✅', '🧹', '🧽', '🧺', '🍽️', '🛏️', '🪥', '🚿', '👕',
  '🎒', '📚', '✏️', '🐈', '🪴', '💧', '🗑️', '♻️', '🧩', '🤝',
  '🍎', '🥗', '🔌', '💡', '🚪', '🌙', '💤', '🎨', '🎵', '🏃',
];
