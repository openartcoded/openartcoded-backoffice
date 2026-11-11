import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  todoApi: { findAll: vi.fn(), save: vi.fn(), delete: vi.fn() },
  postItApi: { findAll: vi.fn(), save: vi.fn(), delete: vi.fn() },
}));

import { postItApi, todoApi } from '@/api/misc';
import { NotesPanel, TodoList } from './widgets';

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

describe('NotesPanel', () => {
  beforeEach(() => {
    vi.mocked(postItApi.findAll).mockResolvedValue([
      { id: 'p1', note: 'older', updatedDate: '2026-11-01T10:00:00' },
      { id: 'p2', note: 'recent', updatedDate: '2026-11-08T10:00:00' },
    ]);
  });

  it('lists the most recent notes first', async () => {
    renderWithProviders(<NotesPanel />);
    await screen.findByDisplayValue('recent');
    const notes = screen.getAllByLabelText('note').map((el) => (el as HTMLTextAreaElement).value);
    expect(notes).toEqual(['recent', 'older']);
  });

  it('adds a note with the button or ctrl+enter', async () => {
    vi.mocked(postItApi.save)
      .mockResolvedValueOnce({ id: 'p3', note: 'first new', updatedDate: '2026-11-11T10:00:00' })
      .mockResolvedValueOnce({ id: 'p4', note: 'second new', updatedDate: '2026-11-11T11:00:00' });
    renderWithProviders(<NotesPanel />);
    await screen.findByDisplayValue('recent');
    const input = screen.getByPlaceholderText('New note...');

    await userEvent.type(input, 'first new');
    await userEvent.click(screen.getByLabelText('save postit'));
    expect(postItApi.save).toHaveBeenCalledWith({ note: 'first new' });
    expect(await screen.findByDisplayValue('first new')).toBeInTheDocument();
    expect(input).toHaveValue('');

    await userEvent.type(input, 'second new{Control>}{Enter}{/Control}');
    expect(postItApi.save).toHaveBeenCalledWith({ note: 'second new' });
    expect(await screen.findByDisplayValue('second new')).toBeInTheDocument();
  });

  it('saves an edited note when leaving it, not when nothing changed', async () => {
    vi.mocked(postItApi.save).mockResolvedValue({ id: 'p2', note: 'recent!', updatedDate: '2026-11-11T10:00:00' });
    renderWithProviders(<NotesPanel />);
    const note = await screen.findByDisplayValue('recent');

    await userEvent.click(note);
    await userEvent.tab();
    expect(postItApi.save).not.toHaveBeenCalled();

    await userEvent.type(note, '!');
    await userEvent.tab();
    expect(postItApi.save).toHaveBeenCalledWith({ id: 'p2', note: 'recent!' });
  });

  it('deletes a note', async () => {
    vi.mocked(postItApi.delete).mockResolvedValue(undefined);
    renderWithProviders(<NotesPanel />);
    await screen.findByDisplayValue('older');
    await userEvent.click(screen.getAllByLabelText('delete postit')[1]);
    expect(postItApi.delete).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByDisplayValue('older')).not.toBeInTheDocument());
  });
});
