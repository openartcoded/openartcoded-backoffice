import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  todoApi: { findAll: vi.fn(), save: vi.fn(), delete: vi.fn() },
  postItApi: { findAll: vi.fn(), save: vi.fn(), delete: vi.fn() },
}));

import { postItApi, todoApi } from '@/api/misc';
import { PostitBoard, TodoList } from './widgets';

describe('TodoList', () => {
  beforeEach(() => {
    vi.mocked(todoApi.findAll).mockResolvedValue([
      { id: '1', title: 'done task', done: true },
      { id: '2', title: 'open task', done: false },
    ]);
  });

  it('lists the open todos first', async () => {
    renderWithProviders(<TodoList />);
    const items = await screen.findAllByText(/task$/);
    expect(items.map((i) => i.textContent)).toEqual(['open task', 'done task']);
  });

  it('adds a todo', async () => {
    vi.mocked(todoApi.save).mockResolvedValue({ id: '3', title: 'new one', done: false });
    renderWithProviders(<TodoList />);
    await screen.findByText('open task');
    await userEvent.click(screen.getByLabelText('add todo'));
    await userEvent.type(screen.getByPlaceholderText('New todo...'), 'new one');
    await userEvent.click(screen.getByLabelText('save todo'));
    expect(todoApi.save).toHaveBeenCalledWith({ title: 'new one', done: false });
    expect(await screen.findByText('new one')).toBeInTheDocument();
  });

  it('toggles and deletes a todo', async () => {
    vi.mocked(todoApi.save).mockResolvedValue({ id: '2', title: 'open task', done: true });
    vi.mocked(todoApi.delete).mockResolvedValue(undefined);
    renderWithProviders(<TodoList />);
    await screen.findByText('open task');
    await userEvent.click(screen.getAllByLabelText('toggle done')[0]);
    expect(todoApi.save).toHaveBeenCalledWith({ id: '2', title: 'open task', done: true });
    await userEvent.click(screen.getAllByLabelText('delete todo')[1]);
    expect(todoApi.delete).toHaveBeenCalledWith('1');
    await waitFor(() => expect(screen.queryByText('done task')).not.toBeInTheDocument());
  });
});

describe('PostitBoard', () => {
  it('always shows an empty post-it to add a note', async () => {
    vi.mocked(postItApi.findAll).mockResolvedValue([{ id: 'p1', note: 'remember' }]);
    vi.mocked(postItApi.save).mockResolvedValue({ id: 'p2', note: 'second', updatedDate: '2026-11-08T10:00:00' });
    renderWithProviders(<PostitBoard />);
    expect(await screen.findByDisplayValue('remember')).toBeInTheDocument();
    const empty = screen.getAllByPlaceholderText('New postIt...').find((el) => (el as HTMLTextAreaElement).value === '')!;
    await userEvent.type(empty, 'second');
    const saveButtons = screen.getAllByLabelText('save postit');
    await userEvent.click(saveButtons[saveButtons.length - 1]);
    expect(postItApi.save).toHaveBeenCalledWith({ id: undefined, note: 'second' });
    // a new empty post-it is added after saving the last one
    await waitFor(() => expect(screen.getAllByPlaceholderText('New postIt...')).toHaveLength(3));
    expect(within(document.body).getAllByLabelText('delete postit')).toHaveLength(2);
  });
});
