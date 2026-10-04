import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultBlock, type EditorBlock } from '@folyo/core';
vi.mock('../../lib/compress-image', () => ({ compressImage: vi.fn() }));
import { compressImage } from '../../lib/compress-image';
import { BlockFields } from './block-fields';
import en from '../../lib/i18n/en';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
const url =
  '/api/assets/assets/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.webp';
function mount(type: 'image' | 'gallery') {
  const block: EditorBlock =
    type === 'image'
      ? {
          id: crypto.randomUUID(),
          type,
          content: createDefaultBlock('image', 'en'),
          position: 0,
        }
      : {
          id: crypto.randomUUID(),
          type,
          content: {
            items: [
              { url: 'https://example.com/first.png', alt: 'First' },
              { url: 'https://example.com/second.png', alt: 'Second' },
            ],
          },
          position: 0,
        };
  function Composer() {
    const [current, setCurrent] = useState(block);
    return (
      <BlockFields
        block={current}
        onChange={setCurrent}
        d={en.editor}
        locale="en"
      />
    );
  }
  render(<Composer />);
  const file = new File(['compressed'], 'photo.webp', { type: 'image/webp' });
  vi.mocked(compressImage).mockResolvedValue({
    file,
    width: 800,
    height: 600,
    alt: 'Uploaded photo',
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ url, assetId: '20000000-0000-4000-8000-000000000002' }),
      ),
  );
  return file;
}
describe('image uploads integrated with block fields', () => {
  it('sets the image URL and preview while keeping alt editable', async () => {
    const file = mount('image');
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText(en.editor.upload.select), file);
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute('src', url),
    );
    expect(
      screen.getByRole('textbox', { name: en.editor.fields.url }),
    ).toHaveValue(url);
    const alt = screen.getByRole('textbox', { name: en.editor.fields.alt });
    expect(alt).toHaveValue('Uploaded photo');
    await user.clear(alt);
    await user.type(alt, 'Accessible description');
    expect(screen.getByRole('img')).toHaveAttribute(
      'alt',
      'Accessible description',
    );
  });
  it('uploads to the selected gallery item while preserving the other item URL', async () => {
    const file = mount('gallery');
    await userEvent
      .setup()
      .upload(screen.getAllByLabelText(en.editor.upload.select)[1]!, file);
    await waitFor(() =>
      expect(screen.getAllByRole('img')[1]).toHaveAttribute('src', url),
    );
    expect(
      screen.getAllByRole('textbox', { name: en.editor.fields.url })[0],
    ).toHaveValue('https://example.com/first.png');
    expect(
      screen.getAllByRole('textbox', { name: en.editor.fields.url })[1],
    ).toHaveValue(url);
  });
});
