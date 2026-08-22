export const SLOTS = ['morning', 'afternoon', 'evening', 'bedtime'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_META: Record<Slot, { label: string; icon: string }> = {
  morning: { label: 'Morning', icon: '🌅' },
  afternoon: { label: 'Afternoon', icon: '☀️' },
  evening: { label: 'Evening', icon: '🌆' },
  bedtime: { label: 'Bedtime', icon: '🌙' },
};

export type Child = {
  id: string;
  name: string;
  color: string;
  avatar: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  icon: string;
  slot: Slot;
  points: number;
  sort_order: number;
  is_active: boolean;
  /** null = shared default chore for every child; set = extra chore for one child */
  child_id: string | null;
  /** null = recurring; set = one-off, only on that Karachi date */
  on_date: string | null;
  created_on: string;
};

export type Completion = {
  id: string;
  child_id: string;
  task_id: string;
  completed_on: string;
  points_awarded: number;
  created_at: string;
};

/** A task as the day view sees it: the task plus this child's state for the date. */
export type DayTask = Task & {
  completed: boolean;
  /** true when this is an extra chore added for this child specifically */
  is_extra: boolean;
};

export type DaySlot = {
  slot: Slot;
  tasks: DayTask[];
};

export type ChildDay = {
  child: Child;
  slots: DaySlot[];
  date: string;
  total: number;
  earned: number;
  completedCount: number;
  taskCount: number;
  isPerfect: boolean;
};

/** Powers the picker badges. */
export type DayTotal = {
  child_id: string;
  points: number;
  completedCount: number;
  taskCount: number;
};

export type MonthTotal = {
  child_id: string;
  points: number;
  perfectDays: number;
};

export type TvChild = {
  child: Child;
  points: number;
  completedCount: number;
  taskCount: number;
  isPerfect: boolean;
  monthPoints: number;
};

export type LatestCompletion = {
  childName: string;
  childColor: string;
  taskTitle: string;
  taskIcon: string;
  points: number;
  at: string;
};
