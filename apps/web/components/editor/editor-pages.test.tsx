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
  localStorage.clear();
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
  return render(
    <Editor document={document} pageId={first} d={en} locale="en" />,
  );
}
describe('editor page switching and autosave', () => {
  it('closes an open page menu on collapse and opens it normally after restoring the sidebar', async () => {
    mount();
    const user = userEvent.setup();
    const options = en.editor.pages.moreOptions.replace('{title}', 'Home');
    await user.click(screen.getByRole('button', { name: options }));
    expect(screen.getByRole('menu')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Hide sidebar/ }));
    expect(
      screen.queryByRole('menu', { hidden: true }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show sidebar/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: options }));
    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('toggles the sidebar, preserves the canvas and restores the stored preference on remount', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const view = mount();
    const sidebar = screen.getByRole('complementary');
    const canvas = screen.getByRole('textbox', { name: 'Text' });
    const toggle = screen.getByRole('button', { name: /Hide sidebar/ });
    expect(sidebar).toBeVisible();
    expect(get).toHaveBeenCalledWith('folyo.editor.sidebar');
    fireEvent.click(toggle);
    expect(sidebar.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(sidebar.parentElement).toHaveAttribute('inert');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('textbox', { name: 'Text' })).toBe(canvas);
    expect(canvas).toHaveValue('Home text');
    expect(set).toHaveBeenCalledWith('folyo.editor.sidebar', 'closed');
    view.unmount();
    mount();
    expect(
      screen.getByRole('button', { name: /Show sidebar/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Show sidebar/ }));
    expect(screen.getByRole('complementary')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(set).toHaveBeenLastCalledWith('folyo.editor.sidebar', 'open');
    vi.restoreAllMocks();
  });
  it.each(['ctrlKey', 'metaKey'])(
    'toggles with %s + backslash and moves sidebar focus to the topbar',
    (modifier) => {
      mount();
      screen.getByRole('button', { name: 'Home' }).focus();
      fireEvent.keyDown(window, {
        key: '\\',
        code: 'Backslash',
        [modifier]: true,
      });
      const toggle = screen.getByRole('button', { name: /Show sidebar/ });
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute(
        'title',
        expect.stringContaining(en.editor.sidebarShortcut),
      );
      fireEvent.keyDown(window, { key: '\\', [modifier]: true });
      expect(screen.getByRole('complementary')).toBeVisible();
    },
  );
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

describe('editor inline page rename', () => {
  it('uses the existing PATCH actor without changing slug or issuing a block save', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        id: first,
        siteId: first,
        title: 'New Home',
        slug: 'home',
        position: 0,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    mount();
    await user.click(
      screen.getByRole('button', {
        name: en.editor.pages.moreOptions.replace('{title}', 'Home'),
      }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: en.editor.pages.renameLabel.replace('{title}', 'Home'),
      }),
    );
    await user.keyboard('New Home{Enter}');
    expect(
      await screen.findByRole('button', { name: 'New Home' }),
    ).toHaveFocus();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      `/api/pages/${first}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'New Home' }),
      }),
    );
    expect(
      screen.queryByRole('textbox', {
        name: en.editor.pages.renameLabel.replace('{title}', 'Home'),
      }),
    ).not.toBeInTheDocument();
  });
  it('shows failed rename inline without the global editor alert', async () => {
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
    await user.click(
      screen.getByRole('button', {
        name: en.editor.pages.moreOptions.replace('{title}', 'Home'),
      }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: en.editor.pages.renameLabel.replace('{title}', 'Home'),
      }),
    );
    await user.keyboard('Draft{Enter}');
    expect(
      await screen.findByText(en.editor.pages.renameError),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: en.editor.pages.renameLabel.replace('{title}', 'Home'),
      }),
    ).toHaveValue('Draft');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Projects' })).toBeEnabled();
  });
});

describe('editor page deletion focus', () => {
  it('restores focus to the surviving active row after confirmed deletion', async () => {
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
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    mount();
    await user.click(
      screen.getByRole('button', {
        name: en.editor.pages.moreOptions.replace('{title}', 'Home'),
      }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: en.editor.pages.deleteLabel.replace('{title}', 'Home'),
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: en.editor.pages.confirm }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Projects' })).toHaveFocus(),
    );
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Projects text',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      `/api/pages/${first}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
