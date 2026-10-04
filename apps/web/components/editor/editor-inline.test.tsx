import { Profiler } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createDefaultBlock,
  type BlockType,
  type EditorBlock,
  type EditorDocument,
} from '@folyo/core';
import { Editor } from './editor';
import { SiteRender } from '../render/site-render';
import en from '../../lib/i18n/en';

vi.mock('../../lib/compress-image', () => ({ compressImage: vi.fn() }));
import { compressImage } from '../../lib/compress-image';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(compressImage).mockReset();
  vi.useRealTimers();
  localStorage.clear();
});
const page = '10000000-0000-4000-8000-000000000001';
const otherPage = '20000000-0000-4000-8000-000000000002';
const theme = {
  accent: '#1E5AA8',
  headingFont: 'lora',
  bodyFont: 'source-sans',
  heroLayout: 'left',
};
function block(type: BlockType, position = 0): EditorBlock {
  return {
    id: crypto.randomUUID(),
    type,
    content: createDefaultBlock(type, 'en'),
    position,
  } as EditorBlock;
}
function mount(
  blocks = [block('heading')],
  multi = false,
  onRender?: React.ProfilerOnRenderCallback,
) {
  const doc: EditorDocument = {
    site: { id: page, handle: 'sample', title: 'Portfolio', status: 'draft' },
    pages: [
      { id: page, siteId: page, title: 'Home', slug: '', position: 0 },
      ...(multi
        ? [
            {
              id: otherPage,
              siteId: page,
              title: 'About',
              slug: 'about',
              position: 1,
            },
          ]
        : []),
    ],
    blocks: blocks.map((item) => ({ ...item, pageId: page })),
  };
  const tree = (
    <Editor document={doc} pageId={page} d={en} locale="en" theme={theme} />
  );
  const view = render(
    onRender ? (
      <Profiler id="canvas" onRender={onRender}>
        {tree}
      </Profiler>
    ) : (
      tree
    ),
  );
  return { ...view, doc, blocks };
}
function edit(type: BlockType, position = 1) {
  const article = screen.getByLabelText(
    `${en.editor.types[type].name} ${position}`,
    { selector: 'article' },
  );
  fireEvent.click(article.querySelector('.inline-block')!);
  return article;
}
function savedFetch() {
  const fetch = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ ok: true, savedAt: '2026-10-04T12:00:00.000Z' }),
    );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
async function debounce() {
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
}
function leave(input: HTMLElement) {
  fireEvent.blur(input, {
    relatedTarget: screen.getByRole('link', { name: en.back }),
  });
}

describe('WYSIWYG controlled block editing', () => {
  it('renders heading first, edits inside its heading, commits on blur and sends one debounced full-list PUT', async () => {
    vi.useFakeTimers();
    const fetch = savedFetch();
    const { blocks } = mount();
    expect(screen.queryByRole('textbox')).toBeNull();
    const card = edit('heading');
    const input = within(card).getByRole('textbox', { name: 'Text' });
    expect(input.closest('h2')).not.toBeNull();
    fireEvent.change(input, { target: { value: 'A new heading' } });
    await debounce();
    expect(fetch).not.toHaveBeenCalled();
    leave(input);
    expect(
      screen.getByRole('heading', { name: 'A new heading' }),
    ).toBeVisible();
    await debounce();
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe(`/api/pages/${page}/blocks`);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body).blocks).toEqual([
      { ...blocks[0], content: { text: 'A new heading', level: 2 } },
    ]);
  });
  it('preserves markdown syntax and renders links, bold, emphasis and lists after Ctrl+Enter', async () => {
    vi.useFakeTimers();
    const fetch = savedFetch();
    mount([block('text')]);
    const card = edit('text');
    const input = within(card).getByRole('textbox', { name: 'Text' });
    const text =
      '**Bold** and *emphasis* with [a link](https://example.com)\n\n- One\n- Two';
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(card.querySelector('strong')).toHaveTextContent('Bold');
    expect(card.querySelector('em')).toHaveTextContent('emphasis');
    expect(within(card).getByRole('link', { name: 'a link' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(within(card).getAllByRole('listitem')).toHaveLength(2);
    await debounce();
    expect(
      JSON.parse(fetch.mock.calls[0]![1].body).blocks[0].content.text,
    ).toBe(text);
  });
  it('edits hero fields at their rendered positions and keeps the chosen layout', async () => {
    vi.useFakeTimers();
    const fetch = savedFetch();
    mount([block('hero')]);
    const card = edit('hero');
    const name = within(card).getByRole('textbox', {
      name: en.editor.fields.name,
    });
    expect(name.closest('h1')).not.toBeNull();
    expect(card.querySelector('.site-hero')).toHaveClass('site-hero-left');
    fireEvent.change(name, { target: { value: 'Maya Chen' } });
    fireEvent.change(
      within(card).getByRole('textbox', { name: en.editor.fields.title }),
      { target: { value: 'Research scientist' } },
    );
    fireEvent.change(
      within(card).getByRole('textbox', { name: en.editor.fields.subtitle }),
      { target: { value: 'Useful discoveries' } },
    );
    fireEvent.keyDown(name, { key: 'Enter', metaKey: true });
    expect(
      within(card).getByRole('heading', { name: 'Maya Chen' }),
    ).toBeVisible();
    expect(within(card).getByText('Research scientist')).toBeVisible();
    await debounce();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('Escape restores only the active block and never sends its canceled changes', async () => {
    vi.useFakeTimers();
    const fetch = savedFetch();
    const { blocks } = mount([block('heading', 0), block('text', 1)]);
    let input = within(edit('heading')).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Keep me' } });
    leave(input);
    input = within(edit('text', 2)).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Discard me' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Keep me' })).toBeVisible();
    expect(screen.queryByText('Discard me')).toBeNull();
    await debounce();
    const data = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(data.blocks[0].content.text).toBe('Keep me');
    expect(data.blocks[1]).toEqual(blocks[1]);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('Zod marks invalid fields and blocks preview/autosave until corrected', async () => {
    const fetch = savedFetch();
    mount();
    const input = within(edit('heading')).getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: en.editor.inline.view }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.editor.inline.previewError,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getAllByText('Fix block 1')).toHaveLength(2);
    const fixed = within(edit('heading')).getByRole('textbox');
    fireEvent.change(fixed, { target: { value: 'Corrected' } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: en.editor.inline.view }),
      );
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole('article')).toBeNull();
  });
  it('opens the image panel while the image remains rendered and preserves debounced save', async () => {
    vi.useFakeTimers();
    const fetch = savedFetch();
    mount([block('image')]);
    const image = screen.getByRole('img');
    fireEvent.click(image);
    expect(image).toBeVisible();
    const card = image.closest('article')!;
    const alt = within(card).getByRole('textbox', {
      name: en.editor.fields.alt,
    });
    fireEvent.change(alt, { target: { value: 'An accessible image' } });
    expect(image).toHaveAttribute('alt', 'An accessible image');
    fireEvent.click(
      within(card).getByRole('button', { name: en.editor.inline.done }),
    );
    await debounce();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('prevents rendered link navigation while a compact card is already being edited', () => {
    mount([block('button')]);
    const card = edit('button');
    const link = within(card).getByRole('link');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(true);
    expect(card.querySelector('.inline-panel')).toBeVisible();
  });
  it('keeps an upload mounted until completion, uses the existing endpoint, and saves its result on confirmation', async () => {
    const user = userEvent.setup();
    mount([block('image')]);
    const card = edit('image');
    const file = new File(['image'], 'photo.webp', { type: 'image/webp' });
    let compressed!: (image: Awaited<ReturnType<typeof compressImage>>) => void;
    vi.mocked(compressImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          compressed = resolve;
        }),
    );
    const url =
      '/api/assets/assets/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.webp';
    const fetch = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === '/api/upload'
          ? Response.json({ url, assetId: otherPage })
          : Response.json({ ok: true, savedAt: '2026-10-04T12:00:00.000Z' }),
      );
    vi.stubGlobal('fetch', fetch);
    await user.upload(
      within(card).getByLabelText(en.editor.upload.select),
      file,
    );
    expect(
      within(card).getByRole('button', { name: en.editor.inline.cancel }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: en.editor.inline.view }),
    );
    expect(card.querySelector('.inline-panel')).toBeVisible();
    await act(async () => {
      compressed({ file, width: 800, height: 600, alt: 'Uploaded photo' });
    });
    expect(within(card).getByRole('img')).toHaveAttribute('src', url);
    expect(fetch).toHaveBeenCalledOnce();
    await user.click(
      screen.getByRole('button', { name: en.editor.inline.view }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetch.mock.calls[1]![1].body);
    expect(body.blocks[0].content).toMatchObject({
      url,
      alt: 'Uploaded photo',
    });
    expect(
      screen.queryByLabelText('Image 1', { selector: 'article' }),
    ).toBeNull();
  });
  it('offers heading levels as H1/H2/H3 without a select', () => {
    mount();
    const card = edit('heading');
    fireEvent.click(within(card).getByRole('button', { name: 'H3' }));
    expect(within(card).getByRole('textbox').closest('h3')).not.toBeNull();
    expect(within(card).getByRole('button', { name: 'H3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('inserts a markdown link at the selected text and keeps Tab navigation natural', async () => {
    const user = userEvent.setup();
    mount([block('text')]);
    const card = edit('text');
    const input = within(card).getByRole('textbox', {
      name: 'Text',
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Visit my work today' } });
    input.setSelectionRange(6, 13);
    await user.click(
      within(card).getByRole('button', { name: en.editor.inline.link }),
    );
    expect(
      within(card).getByRole('textbox', { name: en.editor.inline.linkText }),
    ).toHaveValue('my work');
    await user.type(
      within(card).getByRole('textbox', { name: en.editor.inline.linkUrl }),
      'https://example.com/work',
    );
    await user.click(
      within(card).getByRole('button', { name: en.editor.inline.insertLink }),
    );
    expect(input).toHaveValue(
      'Visit [my work](https://example.com/work) today',
    );
    expect(input).toHaveFocus();
    await user.tab();
    expect(
      within(card).getByRole('button', { name: en.editor.inline.link }),
    ).toHaveFocus();
  });
  it('does not enter editing from the drag handle', () => {
    mount();
    const handle = screen.getByRole('button', { name: en.editor.dragHandle });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.click(handle);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1 });
  });
  it.each(['gallery', 'button', 'social', 'divider', 'spacer'] as const)(
    'edits %s in a compact panel and cancels without mutation',
    (type) => {
      const fetch = savedFetch();
      mount([block(type)]);
      const card = edit(type);
      expect(card.querySelector('.inline-panel')).toBeVisible();
      expect(
        within(card).getByRole('button', { name: en.editor.inline.done }),
      ).toBeVisible();
      fireEvent.click(
        within(card).getByRole('button', { name: en.editor.inline.cancel }),
      );
      expect(card.querySelector('.inline-panel')).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('keeps portal Select options inside the active card and reflects their value', async () => {
    const user = userEvent.setup();
    mount([block('spacer')]);
    const card = edit('spacer');
    await user.click(
      within(card).getByRole('button', { name: en.editor.fields.height }),
    );
    await user.click(
      screen.getByRole('option', { name: en.editor.heights.lg }),
    );
    expect(card.querySelector('.inline-panel')).toBeVisible();
    expect(card.querySelector('.site-spacer')).toHaveStyle({ height: '96px' });
  });
  it('gallery edits one item, reorders it, adds a tile and reverts the whole card on Escape', async () => {
    const gallery = block('gallery');
    if (gallery.type !== 'gallery') throw new Error();
    gallery.content.items.push({
      url: 'https://example.com/second.png',
      alt: 'Second',
    });
    mount([gallery]);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: `${en.editor.inline.editImage} 2` }),
    );
    const card = screen.getByLabelText('Gallery 1', { selector: 'article' });
    expect(
      within(card).getByRole('textbox', { name: en.editor.fields.alt }),
    ).toHaveValue('Second');
    const panel = card.querySelector('.inline-panel')! as HTMLElement;
    await user.click(
      within(panel).getByRole('button', { name: en.editor.moveUp }),
    );
    expect(within(card).getAllByRole('img')[0]).toHaveAttribute(
      'alt',
      'Second',
    );
    await user.click(within(card).getByRole('button', { name: /Add image/ }));
    expect(within(card).getAllByRole('img')).toHaveLength(3);
    fireEvent.keyDown(
      within(card).getByRole('textbox', { name: en.editor.fields.alt }),
      { key: 'Escape' },
    );
    expect(within(card).getAllByRole('img')).toHaveLength(2);
    expect(within(card).getAllByRole('img')[1]).toHaveAttribute(
      'alt',
      'Second',
    );
  });
});

describe('canvas published view', () => {
  it('flushes before showing pure SiteRender, removes chrome, preserves theme and returns to editing', async () => {
    let complete!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const { container, doc, blocks } = mount(undefined, true);
    fireEvent.change(within(edit('heading')).getByRole('textbox'), {
      target: { value: 'Published look' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: en.editor.inline.view }),
      );
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.querySelector('.block-heading')).not.toBeNull();
    await act(async () => {
      complete(
        Response.json({ ok: true, savedAt: '2026-10-04T12:00:00.000Z' }),
      );
    });
    expect(container.querySelector('.block-heading')).toBeNull();
    expect(container.querySelector('.drag-handle')).toBeNull();
    const updated = blocks.map((item) =>
      item.type === 'heading'
        ? { ...item, content: { ...item.content, text: 'Published look' } }
        : item,
    );
    const expected = document.createElement('div');
    expected.innerHTML = renderToStaticMarkup(
      <SiteRender
        theme={theme}
        locale="en"
        pages={doc.pages}
        activePageId={page}
        blocks={updated}
        basePath={`/p/${page}`}
        appUrl="/"
        chrome={en.siteChrome}
      />,
    );
    const actualSite = container.querySelector('.folyo-site') as HTMLElement;
    const expectedSite = expected.querySelector('.folyo-site') as HTMLElement;
    expect(actualSite.innerHTML).toBe(expectedSite.innerHTML);
    expect(actualSite.style.cssText).toBe(expectedSite.style.cssText);
    fireEvent.click(
      screen.getByRole('button', { name: en.editor.inline.edit }),
    );
    expect(container.querySelector('.block-heading')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: en.editor.inline.view }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'About' }));
    });
    expect(
      screen.getByRole('button', { name: en.editor.inline.view }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.block-heading')).toBeNull();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('keeps edit mode available when flush fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'unavailable' }, { status: 503 }),
        ),
    );
    mount();
    fireEvent.change(within(edit('heading')).getByRole('textbox'), {
      target: { value: 'Unsaved' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: en.editor.inline.view }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.editor.inline.previewError,
    );
    expect(
      screen.getByRole('button', { name: en.editor.inline.view }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
  it('measures a 100-block canvas and one controlled edit without introducing a second block model', () => {
    const durations: { phase: string; duration: number }[] = [];
    const items = Array.from({ length: 100 }, (_, index) =>
      block(index % 2 ? 'text' : 'heading', index),
    );
    const { container } = mount(items, false, (_id, phase, duration) =>
      durations.push({ phase, duration }),
    );
    const before = durations.length;
    const card = edit('heading');
    fireEvent.change(within(card).getByRole('textbox'), {
      target: { value: 'Measured update' },
    });
    expect(container.querySelectorAll('.wysiwyg-card')).toHaveLength(100);
    expect(
      container.querySelectorAll('textarea, input:not([type=file])'),
    ).toHaveLength(1);
    console.info(
      'F5b canvas profiler (JSDOM, ms):',
      JSON.stringify(durations.slice(before)),
    );
  });
});
