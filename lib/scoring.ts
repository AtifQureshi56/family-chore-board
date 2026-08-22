import { SLOTS, type DayTask, type DaySlot, type Slot } from './types';

/** Points a child has earned from a set of day tasks. */
export function dayTotal(tasks: DayTask[]): number {
  return tasks.reduce((sum, t) => (t.completed ? sum + t.points : sum), 0);
}

/** Every point available to that child today, completed or not. */
export function dayAvailable(tasks: DayTask[]): number {
  return tasks.reduce((sum, t) => sum + t.points, 0);
}

export function completedCount(tasks: DayTask[]): number {
  return tasks.filter((t) => t.completed).length;
}

/**
 * A perfect day is every chore visible to that child on that date, completed.
 * A child with no chores at all has not had a perfect day.
 */
export function isPerfectDay(tasks: DayTask[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.completed);
}

/** Group a flat task list into the four slots, preserving slot order. */
export function groupBySlot(tasks: DayTask[]): DaySlot[] {
  return SLOTS.map((slot: Slot) => ({
    slot,
    tasks: tasks
      .filter((t) => t.slot === slot)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}
