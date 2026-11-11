import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { Post } from '@/types';

vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  reportApi: { updatePostIts: vi.fn() },
}));

import { reportApi } from '@/api/misc';
import { ScrumBoard } from './components';

const post: Post = {
  id: 'post-1',
  title: 'Sprint',
  description: '',
  todos: [{ id: 't1', note: 'write tests' }],
  inProgress: [],
  done: [{ id: 'd1', note: 'ship it' }],
};

const cards = () => screen.getAllByLabelText('card').map((el) => (el as HTMLTextAreaElement).value);

describe('ScrumBoard', () => {
  beforeEach(() => {
    vi.mocked(reportApi.updatePostIts).mockResolvedValue(post);
  });

  it('shows the columns with their count', () => {
    renderWithProviders(<ScrumBoard post={post} />);
    expect(screen.getByText('To do')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(cards()).toEqual(['write tests', 'ship it']);
    expect(screen.getByText('No cards')).toBeInTheDocument();
  });

  it('adds a card, saved when leaving it', async () => {
    renderWithProviders(<ScrumBoard post={post} />);
    await userEvent.click(screen.getAllByText('Add a card')[1]);
    // the new card has the focus
    await userEvent.keyboard('review');
    await userEvent.tab();
    await waitFor(() =>
      expect(reportApi.updatePostIts).toHaveBeenCalledWith('post-1', {
        todos: [expect.objectContaining({ note: 'write tests' })],
        inProgress: [expect.objectContaining({ note: 'review' })],
        done: [expect.objectContaining({ note: 'ship it' })],
      }),
    );
  });

  it('removes a card left empty', async () => {
    renderWithProviders(<ScrumBoard post={post} />);
    await userEvent.click(screen.getByLabelText('add to To do'));
    expect(cards()).toHaveLength(3);
    await userEvent.tab();
    expect(cards()).toEqual(['write tests', 'ship it']);
    // nothing changed: nothing saved
    expect(reportApi.updatePostIts).not.toHaveBeenCalled();
  });

  it('deletes a card', async () => {
    renderWithProviders(<ScrumBoard post={post} />);
    await userEvent.click(screen.getAllByLabelText('delete')[0]);
    expect(cards()).toEqual(['ship it']);
    await waitFor(() =>
      expect(reportApi.updatePostIts).toHaveBeenCalledWith('post-1', expect.objectContaining({ todos: [] })),
    );
  });

  it('moves a card to another column by drag and drop', async () => {
    renderWithProviders(<ScrumBoard post={post} />);
    const card = screen.getByDisplayValue('write tests').closest('.board-card')!;
    const target = screen.getByText('In progress').closest('.board-column')!;
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    expect(target).toHaveClass('board-column-over');
    fireEvent.drop(target);
    await waitFor(() =>
      expect(reportApi.updatePostIts).toHaveBeenCalledWith('post-1', {
        todos: [],
        inProgress: [expect.objectContaining({ id: 't1', note: 'write tests' })],
        done: [expect.objectContaining({ id: 'd1' })],
      }),
    );
  });
});
