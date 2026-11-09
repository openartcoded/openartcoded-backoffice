import type { DateLike, Message, PostIt, PostItType, PostStatus, Priority, UnreadMessagesCounter } from '@/types';

export const PRIORITIES: { value: Priority; label: string; emoji: string }[] = [
  { value: 'LOW', label: 'Low', emoji: '🔵' },
  { value: 'MEDIUM', label: 'Medium', emoji: '🟡' },
  { value: 'HIGH', label: 'High', emoji: '🟠' },
  { value: 'URGENT', label: 'Urgent', emoji: '🔴' },
];

export const STATUSES: { value: PostStatus; label: string; emoji: string }[] = [
  { value: 'DRAFT', label: 'Draft', emoji: '📝' },
  { value: 'IN_PROGRESS', label: 'In progress', emoji: '⏳' },
  { value: 'PENDING', label: 'Pending', emoji: '🕗' },
  { value: 'DONE', label: 'Done', emoji: '✅' },
  { value: 'CANCELLED', label: 'Cancelled', emoji: '❌' },
];

export const priorityEmoji = (p?: Priority) => PRIORITIES.find((x) => x.value === p)?.emoji ?? '';
export const statusEmoji = (s?: PostStatus) => STATUSES.find((x) => x.value === s)?.emoji ?? '';

export const priorityOptions = PRIORITIES.map((p) => ({ value: p.value, label: p.label }));
export const statusOptions = STATUSES.map((s) => ({ value: s.value, label: s.label }));

export function dueDateStatus(status?: PostStatus, due?: DateLike | null, today: Date = new Date()): string {
  if (!due || status === 'DONE' || status === 'CANCELLED') return 'On track';
  const days = Math.ceil((new Date(due).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} days`;
}

/** sum of the unread messages of the user for the posts of a status */
export function unreadForStatus(
  counters: UnreadMessagesCounter[] | undefined,
  status: PostStatus,
  email?: string,
): number {
  return (counters ?? [])
    .filter((c) => c.status === status && c.subscriber === email)
    .reduce((s, c) => s + c.counter, 0);
}

export function unreadMessages(messages: Message[] | undefined, email?: string): number {
  return (messages ?? []).filter((m) => m.emailFrom !== email && !m.read).length;
}

export function relativeTime(date: DateLike | undefined, now: Date = new Date()): string {
  if (!date) return '';
  const d = new Date(date);
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return d.toLocaleDateString();
}

export type Board = Record<PostItType, PostIt[]>;

/** moves a post-it to another column */
export function movePostIt(board: Board, id: string, to: PostItType): Board {
  const from = (Object.keys(board) as PostItType[]).find((col) => board[col].some((p) => p.id === id));
  if (!from || from === to) return board;
  const item = board[from].find((p) => p.id === id)!;
  return { ...board, [from]: board[from].filter((p) => p.id !== id), [to]: [...board[to], item] };
}

export const boardPayload = (b: Board) => ({ todos: b.TODOS, inProgress: b.IN_PROGRESS, done: b.DONE });
