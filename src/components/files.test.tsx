import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { adminUser, renderWithProviders } from '@/test/utils';
import { sessionMock } from '@/test/mocks';

vi.mock('@/auth/session', () => sessionMock(adminUser));
vi.mock('@/api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/files')>()),
  filesApi: { text: vi.fn(), blob: vi.fn(), download: vi.fn() },
}));

import { filesApi } from '@/api/files';
import { FileViewer } from './files';

describe('FileViewer', () => {
  it('shows the error instead of loading forever', async () => {
    vi.mocked(filesApi.blob).mockRejectedValue(new Error('Request failed with status code 500'));
    renderWithProviders(<FileViewer file={{ id: '1', contentType: 'image/png', originalFilename: 'a.png' }} />);
    expect(await screen.findByText('Request failed with status code 500')).toBeInTheDocument();
  });

  it('loads the image typed with the content type of the upload', async () => {
    vi.mocked(filesApi.blob).mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    renderWithProviders(<FileViewer file={{ id: '1', contentType: 'image/png', originalFilename: 'a.png' }} />);
    expect(await screen.findByAltText('a.png')).toBeInTheDocument();
    expect(filesApi.blob).toHaveBeenCalledWith('1', 'image/png');
  });

  it('downloads with the original filename as fallback', async () => {
    vi.mocked(filesApi.blob).mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    vi.mocked(filesApi.download).mockResolvedValue(undefined);
    renderWithProviders(<FileViewer file={{ id: '1', contentType: 'image/png', originalFilename: 'a.png' }} />);
    screen.getByLabelText('download').click();
    expect(filesApi.download).toHaveBeenCalledWith('1', 'a.png');
  });
});
