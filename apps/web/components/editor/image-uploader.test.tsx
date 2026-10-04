import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../../lib/compress-image', () => ({ compressImage: vi.fn() }));
import { compressImage } from '../../lib/compress-image';
import { ImageUploader } from './image-uploader';
import en from '../../lib/i18n/en';
const url =
  '/api/assets/assets/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.webp';
const result = { url, assetId: '20000000-0000-4000-8000-000000000002' };
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('ImageUploader', () => {
  it('compresses before upload, sends final metadata and passes URL/alt to the block', async () => {
    const original = new File(
      [new Uint8Array(8 * 1024 * 1024)],
      'landscape.jpg',
      { type: 'image/jpeg' },
    );
    const compressed = new File(['compressed'], 'landscape.webp', {
      type: 'image/webp',
    });
    vi.mocked(compressImage).mockResolvedValue({
      file: compressed,
      width: 1600,
      height: 800,
      alt: 'landscape',
    });
    const fetch = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal('fetch', fetch);
    const onUpload = vi.fn();
    render(<ImageUploader d={en.editor} onUpload={onUpload} />);
    await userEvent
      .setup()
      .upload(screen.getByLabelText(en.editor.upload.select), original);
    expect(await screen.findByText(/Image uploaded/)).toBeInTheDocument();
    expect(compressImage).toHaveBeenCalledWith(original);
    const form = fetch.mock.calls[0]?.[1].body as FormData;
    expect((form.get('file') as File).type).toBe('image/webp');
    expect(form.get('width')).toBe('1600');
    expect(form.get('height')).toBe('800');
    expect(form.get('alt')).toBe('landscape');
    expect(onUpload).toHaveBeenCalledWith(url, 'landscape');
  });
  it('keeps the compressed file for a manual retry after a network failure', async () => {
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    vi.mocked(compressImage).mockResolvedValue({
      file,
      width: 10,
      height: 10,
      alt: 'photo',
    });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(Response.json(result));
    vi.stubGlobal('fetch', fetch);
    const onUpload = vi.fn();
    render(<ImageUploader d={en.editor} onUpload={onUpload} />);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText(en.editor.upload.select), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.editor.upload.error,
    );
    expect(onUpload).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: en.editor.upload.retry }),
    );
    expect(await screen.findByText(/Image uploaded/)).toBeInTheDocument();
    expect(compressImage).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
