import { describe, expect, it } from 'vitest';
import { dueDateStatus, movePostIt, relativeTime, unreadForStatus, unreadMessages, type Board } from './logic';

describe('report helpers', () => {
  const today = new Date(2026, 10, 8, 12);

  it('describes the due date status', () => {
    expect(dueDateStatus('IN_PROGRESS', undefined, today)).toBe('On track');
    expect(dueDateStatus('DONE', new Date(2026, 0, 1), today)).toBe('On track');
    expect(dueDateStatus('IN_PROGRESS', new Date(2026, 10, 6, 12), today)).toBe('2 days overdue');
    expect(dueDateStatus('IN_PROGRESS', new Date(2026, 10, 8, 12), today)).toBe('Due today');
    expect(dueDateStatus('IN_PROGRESS', new Date(2026, 10, 11, 12), today)).toBe('Due in 3 days');
    expect(dueDateStatus('IN_PROGRESS', new Date(2026, 10, 28, 12), today)).toBe('Due in 20 days');
  });

  it('counts the unread messages of the user', () => {
    const counters = [
      { status: 'DRAFT' as const, subscriber: 'me@x.be', counter: 2 },
      { status: 'DRAFT' as const, subscriber: 'me@x.be', counter: 1 },
      { status: 'DRAFT' as const, subscriber: 'other@x.be', counter: 5 },
      { status: 'DONE' as const, subscriber: 'me@x.be', counter: 7 },
    ];
    expect(unreadForStatus(counters, 'DRAFT', 'me@x.be')).toBe(3);
    expect(unreadForStatus(undefined, 'DRAFT', 'me@x.be')).toBe(0);
    expect(unreadMessages([{ emailFrom: 'other', read: false }, { emailFrom: 'me', read: false }, { emailFrom: 'other', read: true }], 'me')).toBe(1);
  });

  it('formats relative times', () => {
    const now = new Date(2026, 10, 8, 12, 0);
    expect(relativeTime(new Date(2026, 10, 8, 11, 59, 30), now)).toBe('Just now');
    expect(relativeTime(new Date(2026, 10, 8, 11, 45), now)).toBe('15m ago');
    expect(relativeTime(new Date(2026, 10, 8, 9, 0), now)).toBe('3h ago');
  });

  it('moves a post-it between columns', () => {
    const board: Board = { TODOS: [{ id: '1', note: 'a' }], IN_PROGRESS: [], DONE: [{ id: '2', note: 'b' }] };
    const moved = movePostIt(board, '1', 'IN_PROGRESS');
    expect(moved.TODOS).toHaveLength(0);
    expect(moved.IN_PROGRESS.map((p) => p.id)).toEqual(['1']);
    expect(movePostIt(board, '2', 'DONE')).toBe(board);
    expect(movePostIt(board, 'unknown', 'DONE')).toBe(board);
  });
});
