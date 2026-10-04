import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EditorDocument } from '@folyo/core';
import { Editor } from './editor';
import en from '../../lib/i18n/en';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
const first = '10000000-0000-4000-8000-000000000001';
const second = '20000000-0000-4000-8000-000000000002';
function mount() {
  const document: EditorDocument = {
    site: { id: first, handle: 'test', title: null, status: 'draft' },
    pages: [
      { id: first, siteId: first, title: 'Home', slug: 'home', position: 0 },
      {
        id: second,
        siteId: first,
        title: 'Projects',
        slug: 'projects',
        position: 1,
      },
    ],
    blocks: [
      {
        id: first,
        pageId: first,
        type: 'text',
        content: { text: 'Home text' },
        position: 0,
      },
      {
        id: second,
        pageId: second,
        type: 'text',
        content: { text: 'Projects text' },
        position: 0,
      },
    ],
  };
  render(<Editor document={document} pageId={first} d={en} locale="en" />);
}
describe('editor page switching and autosave', () => {
  it('flushes exactly one pending PUT before replacing the canvas and preserves edits when returning', async () => {
    vi.useFakeTimers();
    let complete!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'Edited Home' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      `/api/pages/${first}/blocks`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('Edited Home'),
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Edited Home',
    );
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await act(async () => {
      complete(
        Response.json({ ok: true, savedAt: '2026-10-03T12:00:00.000Z' }),
      );
    });
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Projects text',
    );
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    });
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Edited Home',
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('blocks switching on failed save and retains editable content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'unavailable' }, { status: 503 }),
        ),
    );
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByRole('textbox', { name: 'Text' }), ' edited');
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.editor.pages.switchError,
    );
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Home text edited',
    );
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('blocks switching with invalid content without issuing a PUT', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'x'.repeat(5001) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.editor.pages.switchError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('creates an empty page and disables creation at five pages', async () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    let count = 2;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, options: { body: string }) => {
        const { title } = JSON.parse(options.body) as { title: string };
        return Response.json({
          id: crypto.randomUUID(),
          siteId: first,
          title,
          slug: title.toLowerCase(),
          position: count++,
        });
      }),
    );
    const user = userEvent.setup();
    mount();
    for (const title of ['Three', 'Four', 'Five']) {
      await user.click(
        screen.getByRole('button', { name: en.editor.pages.newPage }),
      );
      await user.type(
        screen.getByRole('textbox', { name: en.editor.pages.title }),
        title,
      );
      await user.click(
        screen.getByRole('button', {
          name: en.editor.pages.create,
        }),
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: title })).toHaveAttribute(
          'aria-current',
          'page',
        ),
      );
      expect(screen.getByText(en.editor.empty)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('button', { name: en.editor.pages.newPage }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: en.editor.pages.newPage })
        .parentElement,
    ).toHaveAttribute('title', en.editor.pages.limit);
    vi.restoreAllMocks();
  });
});
